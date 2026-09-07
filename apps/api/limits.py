"""Small in-memory admission limits for this single-worker hosted prototype."""

from collections import deque
import time
from fastapi import HTTPException


class GenerationLimits:
    def __init__(self, per_hour=60, per_owner=20, clock=time.monotonic):
        self.per_hour = per_hour
        self.per_owner = per_owner
        self.clock = clock
        self.attempts = deque()

    def admit(self, owner):
        now = self.clock()
        while self.attempts and self.attempts[0][0] <= now - 3600:
            self.attempts.popleft()
        if len(self.attempts) >= self.per_hour:
            raise HTTPException(
                429,
                "The prototype's live generation allowance is temporarily full. Demo mode is still available.",
            )
        if sum(item[1] == owner for item in self.attempts) >= self.per_owner:
            raise HTTPException(
                429,
                "This session has reached its hourly live generation allowance. Demo mode is still available.",
            )
        self.attempts.append((now, owner))
