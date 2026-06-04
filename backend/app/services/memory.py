import json
from typing import Dict, Any

class MemorySystem:
    def __init__(self):
        self.behavioral_memory = {}

    def record_interaction(self, user_id: int, query: str, selected_sources: list):
        """
        Record user feedback on queries and source documents to learn retrieval preferences.
        """
        if user_id not in self.behavioral_memory:
            self.behavioral_memory[user_id] = []
            
        self.behavioral_memory[user_id].append({
            "query": query,
            "selected_sources": selected_sources,
            "timestamp": datetime.now().isoformat()
        })

    def get_preferred_sources(self, user_id: int, query: str) -> list:
        """
        Returns previously successful or highly relevant source domains for a given user.
        """
        user_history = self.behavioral_memory.get(user_id, [])
        preferred = []
        for hist in user_history:
            if hist["query"] in query or query in hist["query"]:
                preferred.extend(hist["selected_sources"])
        return list(set(preferred))

from datetime import datetime
memory_system = MemorySystem()
