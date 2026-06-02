use bastion_core::event::SecurityEvent;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// A fixed-size sliding window of recent SecurityEvent objects.
/// When the buffer is full, the oldest event is dropped to make room for new events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBuffer {
    events: VecDeque<SecurityEvent>,
    capacity: usize,
    window_seconds: u64,
}

impl EventBuffer {
    pub fn new(capacity: usize, window_seconds: u64) -> Self {
        Self {
            events: VecDeque::with_capacity(capacity),
            capacity,
            window_seconds,
        }
    }

    /// Push a new event into the buffer and expire events older than the window.
    pub fn push(&mut self, event: SecurityEvent) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.events.push_back(event);

        while self.events.len() > self.capacity {
            self.events.pop_front();
        }

        let cutoff = now.saturating_sub(self.window_seconds);
        while let Some(front) = self.events.front() {
            if front.timestamp < cutoff {
                self.events.pop_front();
            } else {
                break;
            }
        }
    }

    /// Return all events currently in the buffer.
    pub fn events(&self) -> &VecDeque<SecurityEvent> {
        &self.events
    }

    /// Count events matching a predicate.
    pub fn count_matching<F>(&self, predicate: F) -> usize
    where
        F: Fn(&SecurityEvent) -> bool,
    {
        self.events.iter().filter(|e| predicate(e)).count()
    }

    /// Find events matching a predicate, returning them in chronological order.
    pub fn find_matching<F>(&self, predicate: F) -> Vec<&SecurityEvent>
    where
        F: Fn(&SecurityEvent) -> bool,
    {
        self.events.iter().filter(|e| predicate(e)).collect()
    }

    /// Current number of events in the buffer.
    pub fn len(&self) -> usize {
        self.events.len()
    }

    /// Whether the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }
}

impl Default for EventBuffer {
    fn default() -> Self {
        Self::new(10_000, 86_400) // 10k events, 24-hour window
    }
}
