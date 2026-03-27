# Immutability and Pure Functions

Immutable array/object operations, pure function patterns, and state updates for React/Redux.

## Core Principles

1. **Immutability**: Never modify data in place
2. **Pure functions**: Same input → same output, no side effects
3. **First-class functions**: Functions as values, passed and composed
4. **Declarative style**: Describe what, not how

## Immutable Array Patterns

```javascript
const numbers = [1, 2, 3, 4, 5];

// Add / prepend
const withSix = [...numbers, 6];
const withZero = [0, ...numbers];

// Remove by value / by index (ES2023)
const withoutThree = numbers.filter(n => n !== 3);
const withoutSecond = numbers.toSpliced(1, 1);

// Update element (ES2023)
const updated = numbers.with(2, 99);
const doubledAtTwo = numbers.with(2, numbers.at(2) * 2);

// Non-mutating sort / reverse (ES2023)
const sorted = numbers.toSorted((a, b) => b - a);
const reversed = numbers.toReversed();
```

## Immutable Object Patterns

```javascript
const user = { name: 'Alice', age: 30 };

// Add / update property
const updated = { ...user, age: 31 };

// Nested update
const withNewCity = {
  ...user,
  address: { ...user.address, city: 'LA' }
};

// Remove property
const { age, ...userWithoutAge } = user;

// Rename property
const { name: fullName, ...rest } = user;
const renamed = { fullName, ...rest };

// Conditional property
const maybeAdmin = {
  ...user,
  ...(isAdmin && { role: 'admin' })
};
```

## Deep Operations

```javascript
// Deep clone — preserves types, handles circular refs
const clone = structuredClone(obj);

// Deep update helper
function updatePath(obj, path, value) {
  const keys = path.split('.');
  if (keys.length === 1) return { ...obj, [keys[0]]: value };
  return {
    ...obj,
    [keys[0]]: updatePath(obj[keys[0]], keys.slice(1).join('.'), value)
  };
}
const updated = updatePath(state, 'user.profile.name', 'Bob');
```

## Pure Functions

```javascript
// ✅ Pure: deterministic, no side effects
function add(a, b) { return a + b; }

function formatUser(user) {
  return {
    displayName: `${user.firstName} ${user.lastName}`,
    initials: `${user.firstName[0]}${user.lastName[0]}`
  };
}

// ❌ Impure: modifies external state
let counter = 0;
function incrementCounter() { counter++; return counter; }

// ❌ Impure: non-deterministic
function getRandomUser(users) {
  return users[Math.floor(Math.random() * users.length)];
}

// ❌ Impure: side effect
function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}
```

### Purifying Impure Functions

```javascript
// Inject current time instead of reading Date.now() internally
function isExpired(token, now) { return token.expiresAt < now; }
isExpired(token, Date.now());

// Inject randomness — deterministic in tests (ES2023)
function shuffle(array, random = Math.random) {
  return array.toSorted(() => random() - 0.5);
}
shuffle(items);              // random
shuffle(items, () => 0.5);  // deterministic for tests
```

## State Updates (React/Redux)

```javascript
// Array operations
const addTodo    = (todos, newTodo) => [...todos, newTodo];
const removeTodo = (todos, id)      => todos.filter(t => t.id !== id);
const updateTodo = (todos, id, updates) =>
  todos.map(t => t.id === id ? { ...t, ...updates } : t);
const toggleTodo = (todos, id) =>
  todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
const moveTodo = (todos, fromIndex, toIndex) => {
  const result = todos.toSpliced(fromIndex, 1);
  return result.toSpliced(toIndex, 0, todos[fromIndex]);
};

// Nested state update
const setIn = (obj, path, value) => {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...obj, [head]: value };
  return { ...obj, [head]: setIn(obj[head] ?? {}, rest, value) };
};
const newState = setIn(state, ['users', 'u1', 'profile', 'name'], 'Alice');
```
