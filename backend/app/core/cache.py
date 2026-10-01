"""
Простой in-memory TTL-кэш для аналитических endpoints.
Ключ строится из имени функции + сериализованных параметров запроса.
TTL по умолчанию — 5 минут: данные достаточно свежие для аналитики.
"""

import hashlib
import json
import time
from typing import Any

_store: dict[str, tuple[Any, float]] = {}


def _make_key(namespace: str, **kwargs) -> str:
    serializable = {k: str(v) for k, v in sorted(kwargs.items())}
    raw = namespace + ":" + json.dumps(serializable)
    return f"{namespace}:{hashlib.md5(raw.encode()).hexdigest()}"


def cache_get(namespace: str, **kwargs) -> tuple[bool, Any]:
    key = _make_key(namespace, **kwargs)
    if key in _store:
        value, expires_at = _store[key]
        if time.monotonic() < expires_at:
            return True, value
        del _store[key]
    return False, None


def cache_set(namespace: str, value: Any, ttl: int = 300, **kwargs) -> None:
    key = _make_key(namespace, **kwargs)
    _store[key] = (value, time.monotonic() + ttl)


def cache_clear(namespace: str | None = None) -> None:
    """
    Сбрасывает кэш приложения.

    Args:
        namespace (str | None): Пространство имен для точечной инвалидации.
            Если указано, удаляются только ключи данного пространства (например, 'projects').
            Если None, сбрасывается всё хранилище кэша.
    """
    if namespace is None:
        _store.clear()
    else:
        prefix = f"{namespace}:"
        keys_to_delete = [k for k in _store if k.startswith(prefix)]
        for k in keys_to_delete:
            _store.pop(k, None)
