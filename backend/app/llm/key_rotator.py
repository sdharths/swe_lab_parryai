from typing import List

class KeyRotator:
    def __init__(self, keys: List[str] = None):
        self.keys = keys or []
        self.current_index = 0

    def get_key(self) -> str:
        if not self.keys:
            return None
        return self.keys[self.current_index]

    def rotate(self) -> None:
        if self.keys:
            self.current_index = (self.current_index + 1) % len(self.keys)
