"""
In-memory sliding-window rate limiter for auth endpoints.

Prevents brute-force attacks by limiting requests per IP address.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    """Simple sliding-window rate limiter using in-memory storage."""

    def __init__(self):
        # {ip: [timestamp, timestamp, ...]}
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, ip: str, max_requests: int, window_seconds: int) -> None:
        """Raise HTTPException(429) if the IP exceeds rate limit."""
        now = time.monotonic()
        cutoff = now - window_seconds

        # Clean expired entries for this IP
        self._requests[ip] = [ts for ts in self._requests[ip] if ts > cutoff]

        if len(self._requests[ip]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Try again in {window_seconds} seconds.",
            )

        self._requests[ip].append(now)


# Global rate limiter instance
rate_limiter = RateLimiter()


def rate_limit_login(request: Request) -> None:
    """Dependency: max 5 login attempts per minute per IP."""
    ip = request.client.host if request.client else "unknown"
    rate_limiter.check(ip, max_requests=5, window_seconds=60)


def rate_limit_register(request: Request) -> None:
    """Dependency: max 3 registrations per minute per IP."""
    ip = request.client.host if request.client else "unknown"
    rate_limiter.check(ip, max_requests=3, window_seconds=60)
