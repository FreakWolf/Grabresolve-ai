"""
GrabResolve AI - Per-Ticket Token Usage Tracker
Captures Nova API token consumption across all agents per ticket.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import threading


@dataclass
class TicketTokenUsage:
    ticket_id: str
    calls: List[Dict] = field(default_factory=list)

    def add_call(self, agent_name: str, usage: dict):
        """Record one LLM call's token usage."""
        if not usage:
            return
        self.calls.append({
            "agent": agent_name,
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0)
        })

    @property
    def total_input(self) -> int:
        return sum(c["prompt_tokens"] for c in self.calls)

    @property
    def total_output(self) -> int:
        return sum(c["completion_tokens"] for c in self.calls)

    @property
    def total_tokens(self) -> int:
        return self.total_input + self.total_output

    def summary(self) -> Dict:
        return {
            "ticket_id": self.ticket_id,
            "total_tokens": self.total_tokens,
            "input_tokens": self.total_input,
            "output_tokens": self.total_output,
            "calls_made": len(self.calls),
            "breakdown_by_agent": self.calls
        }

    def pretty_print(self):
        """Console-friendly summary."""
        print(f"\n💰 Token Usage for {self.ticket_id}")
        print(f"   Total: {self.total_tokens:,} tokens "
              f"({self.total_input:,} in / {self.total_output:,} out)")
        for call in self.calls:
            print(f"   ├─ {call['agent']:15s} "
                  f"{call['prompt_tokens']:>5} in / "
                  f"{call['completion_tokens']:>4} out")


# Thread-safe per-ticket storage
_storage: Dict[str, TicketTokenUsage] = {}
_lock = threading.Lock()


def start_tracking(ticket_id: str) -> TicketTokenUsage:
    """Initialize a tracker for a new ticket investigation."""
    with _lock:
        tracker = TicketTokenUsage(ticket_id=ticket_id)
        _storage[ticket_id] = tracker
        return tracker


def get_tracker(ticket_id: str) -> Optional[TicketTokenUsage]:
    """Retrieve the tracker for an in-progress ticket."""
    return _storage.get(ticket_id)


def finish_tracking(ticket_id: str) -> Optional[Dict]:
    """Get final summary and remove from active storage."""
    with _lock:
        tracker = _storage.pop(ticket_id, None)
        return tracker.summary() if tracker else None