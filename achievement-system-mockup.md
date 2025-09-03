# New Achievement System Visual Mockup

## Main Achievement Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                           MY ACHIEVEMENTS                               │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                       ACHIEVEMENT PROGRESS                              │
│                                                                         │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐      │
│   │   17/47   │    │    36%    │    │    822    │    │  5d 23h   │      │
│   │Achievements│    │ Completion│    │Books Read │    │Listening  │      │
│   └───────────┘    └───────────┘    └───────────┘    └───────────┘      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   RECENTLY UNLOCKED                                                     │
│                                                                         │
│   ┌───────────────────────┐    ┌───────────────────────┐                │
│   │ ✓                     │    │ ✓                     │                │
│   │                       │    │                       │                │
│   │ Night Owl             │    │ Audiobook Expert      │                │
│   │ Listen for 3+ hours   │    │ Finish 25 audiobooks  │                │
│   │ after midnight        │    │                       │                │
│   │                       │    │                       │                │
│   │ Unlocked today        │    │ Unlocked 2 days ago   │                │
│   └───────────────────────┘    └───────────────────────┘                │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   READING ACHIEVEMENTS (5/10)                                           │
│                                                                         │
│   ┌───────────────────────┐    ┌───────────────────────┐                │
│   │ ✓                     │    │ 50/100                │                │
│   │                       │    │ [██████████░░░░░░░░░░] │                │
│   │ Bookworm              │    │ Book Marathon         │                │
│   │ Read 10 books         │    │ Read 100 books        │                │
│   │                       │    │                       │                │
│   │ Unlocked 30 days ago  │    │                       │                │
│   └───────────────────────┘    └───────────────────────┘                │
│                                                                         │
│   ┌───────────────────────┐    ┌───────────────────────┐                │
│   │ 🔒                    │    │ 🔒                    │                │
│   │                       │    │                       │                │
│   │ Librarian             │    │ Speed Reader          │                │
│   │ Read 500 books        │    │ Finish a book in      │                │
│   │                       │    │ under 2 hours         │                │
│   │                       │    │                       │                │
│   └───────────────────────┘    └───────────────────────┘                │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   LISTENING ACHIEVEMENTS (7/15)                                         │
│                                                                         │
│   ┌───────────────────────┐    ┌───────────────────────┐                │
│   │ ✓                     │    │ ✓                     │                │
│   │                       │    │                       │                │
│   │ Daily Listener        │    │ Weekend Warrior       │                │
│   │ Listen for 30 days    │    │ Listen for 3+ hours   │                │
│   │ in a row              │    │ on a weekend          │                │
│   │                       │    │                       │                │
│   │ Unlocked 5 days ago   │    │ Unlocked 10 days ago  │                │
│   └───────────────────────┘    └───────────────────────┘                │
│                                                                         │
│   ┌───────────────────────┐                                             │
│   │ 18/24                 │                                             │
│   │ [███████████████░░░░░] │                                             │
│   │ Time Lord             │                                             │
│   │ Listen for a total of │                                             │
│   │ 24 hours              │                                             │
│   │                       │                                             │
│   └───────────────────────┘                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Achievement Card Types

### Unlocked Achievement
```
┌───────────────────────┐
│ ✓                     │
│                       │
│ Achievement Name      │
│ Achievement           │
│ description text      │
│                       │
│ Unlocked 5 days ago   │
└───────────────────────┘
```

### In-Progress Achievement
```
┌───────────────────────┐
│ 50/100                │
│ [██████████░░░░░░░░░░] │
│ Achievement Name      │
│ Achievement           │
│ description text      │
│                       │
│                       │
└───────────────────────┘
```

### Locked Achievement
```
┌───────────────────────┐
│ 🔒                    │
│                       │
│ Achievement Name      │
│ Achievement           │
│ description text      │
│                       │
│                       │
└───────────────────────┘
```

## Color Scheme

- Background: Dark theme (#1F2937)
- Card Background: Slightly lighter (#374151)
- Completed: Green accent (#10B981)
- In Progress: Blue accent (#3B82F6)
- Locked: Gray (#6B7280)
- Text: White for headings, Light gray for descriptions

## Mobile Responsiveness

On mobile devices, the grid layout adjusts to single column:

```
┌───────────────────────┐
│ ACHIEVEMENT PROGRESS  │
│                       │
│ 17/47 Achievements    │
│ 36% Completion        │
│ 822 Books Read        │
│ 5d 23h Listening      │
└───────────────────────┘

┌───────────────────────┐
│ RECENTLY UNLOCKED     │
│                       │
│ [Night Owl Card]      │
│ [Audiobook Card]      │
└───────────────────────┘

┌───────────────────────┐
│ READING (5/10)        │
│                       │
│ [Bookworm Card]       │
│ [Book Marathon Card]  │
│ [Librarian Card]      │
│ [Speed Reader Card]   │
└───────────────────────┘
```

This design completely replaces the abstract UI with clear, informative displays that show achievement progress in an intuitive way. No more confusing yellow lines or empty sections.
