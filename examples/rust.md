# Zephyr Rust Example

Generate strongly-typed Rust code from your Zephyr schema.

## Generate Rust Code

```bash
zephyrc --schema player.zephyr --rust player.rs
```

## Schema

```zephyr
enum PlayerClass {
  WARRIOR = 0;
  MAGE = 1;
  ROGUE = 2;
}

struct Position {
  float x;
  float y;
}

message Player {
  uint id = 1;
  string username = 2;
  PlayerClass class = 3;
  Position position = 4;
  bool[] achievements = 5;
  map<string, int> stats = 6;
}
```

## Generated Code Features

### Enums with Helpers

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
#[repr(u32)]
pub enum PlayerClass {
    #[default]
    Warrior = 0,
    Mage = 1,
    Rogue = 2,
}

impl PlayerClass {
    pub const ALL: &'static [PlayerClass] = &[
        PlayerClass::Warrior,
        PlayerClass::Mage,
        PlayerClass::Rogue,
    ];

    pub fn from_u32(value: u32) -> Option<Self> { ... }
    pub fn as_str(&self) -> &'static str { ... }
    pub fn value(&self) -> u32 { ... }
}

// Display trait for easy printing
println!("{}", PlayerClass::Mage); // "MAGE"
```

### Structs with Builder Pattern

```rust
#[derive(Debug, Clone, Default, PartialEq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

impl Position {
    pub fn new() -> Self { Self::default() }
    pub fn with_x(mut self, value: f32) -> Self { self.x = value; self }
    pub fn with_y(mut self, value: f32) -> Self { self.y = value; self }
}

// Usage
let pos = Position::new()
    .with_x(100.0)
    .with_y(50.0);
```

### Messages with Optional Fields

```rust
#[derive(Debug, Clone, Default, PartialEq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Player {
    pub id: Option<u32>,
    pub username: Option<String>,
    pub class: Option<PlayerClass>,
    pub position: Option<Position>,
    pub achievements: Option<Vec<bool>>,
    pub stats: Option<HashMap<String, i32>>,
}

impl Player {
    pub fn new() -> Self { Self::default() }

    // Builder methods
    pub fn with_id(mut self, value: u32) -> Self { ... }
    pub fn with_username(mut self, value: impl Into<String>) -> Self { ... }

    // Getters with proper borrowing
    pub fn id(&self) -> Option<u32> { self.id }
    pub fn username(&self) -> Option<&str> { self.username.as_deref() }
    pub fn has_id(&self) -> bool { self.id.is_some() }
}
```

## Encode & Decode

```rust
use player::{Player, PlayerClass, Position, Encode, Decode, ByteBuffer};

fn main() -> std::io::Result<()> {
    // Create a player
    let player = Player::new()
        .with_id(42)
        .with_username("pixel_warrior")
        .with_class(PlayerClass::Mage)
        .with_position(Position::new().with_x(127.5).with_y(89.3))
        .with_achievements(vec![true, true, false, true])
        .with_stats({
            let mut m = HashMap::new();
            m.insert("strength".into(), 45);
            m.insert("magic".into(), 98);
            m
        });

    // Encode to binary
    let mut buffer = ByteBuffer::new();
    player.encode(&mut buffer);
    let bytes = buffer.into_bytes();

    println!("Encoded {} bytes", bytes.len());

    // Decode from binary
    let mut buffer = ByteBuffer::from_bytes(bytes);
    let decoded = Player::decode(&mut buffer)?;

    println!("Player: {} (Level {})",
        decoded.username().unwrap_or("Unknown"),
        decoded.id().unwrap_or(0)
    );

    Ok(())
}
```

## Serde Support

Enable the `serde` feature for JSON serialization:

```toml
[features]
serde = ["serde"]
```

```rust
let player = Player::new().with_username("test");

// To JSON
let json = serde_json::to_string(&player)?;

// From JSON
let parsed: Player = serde_json::from_str(&json)?;
```

## Comparison: Zephyr vs Kiwi Rust

| Feature         | Kiwi              | Zephyr                        |
| --------------- | ----------------- | ----------------------------- |
| Code generation | ✗ Runtime only    | ✓ Compile-time                |
| Type safety     | ✗ Dynamic `Value` | ✓ Strongly typed              |
| Serde support   | ✗                 | ✓ Feature flag                |
| Builder pattern | ✗                 | ✓ `.with_*()`                 |
| Enum helpers    | ✗                 | ✓ `ALL`, `from_u32`, `as_str` |
| Map support     | ✗                 | ✓ `HashMap<K, V>`             |
| Fixed arrays    | ✗                 | ✓ `[T; N]`                    |

Kiwi only provides a runtime library with dynamic `Value` types. Zephyr generates actual Rust structs with full compile-time type checking.
