"""Bootstrap de estado mínimo do worker (idempotente)."""
from intelliforce.bootstrap.service_user import (
    WORKER_USER_EMAIL,
    WORKER_USER_NAME,
    ensure_worker_service_user,
)

__all__ = [
    "WORKER_USER_EMAIL",
    "WORKER_USER_NAME",
    "ensure_worker_service_user",
]
