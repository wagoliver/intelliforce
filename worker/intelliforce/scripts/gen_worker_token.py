"""Gera JWT longo (TTL 365 dias) pra service account `worker-internal`.

Uso:
  docker compose exec worker python -m intelliforce.scripts.gen_worker_token

Output: imprime o JWT em stdout. Copie pro .env como:

  INTELLIFORCE_WORKER_TOKEN=eyJ...

E reinicie o worker (`docker compose up -d worker api`) pra ele
usar o novo token nas scheduled tasks.

⚠️ O token assinado com JWT_SECRET — proteger o .env. Se vazar, regerar
imediatamente (rodar este script de novo invalida operacionalmente o
anterior porque você sobrescreve no .env; tokens antigos continuam
válidos até expirarem, mas ficam órfãos sem fonte oficial).
"""
from __future__ import annotations

import asyncio
import sys
from datetime import timedelta

from intelliforce.api.security import create_access_token
from intelliforce.bootstrap import ensure_worker_service_user

DEFAULT_TTL_DAYS = 365


async def main() -> int:
    user = await ensure_worker_service_user()
    token = create_access_token(
        subject=str(user.id),
        extra_claims={"is_service": True, "role": user.role},
        expires_delta=timedelta(days=DEFAULT_TTL_DAYS),
    )
    print(token)
    print(
        f"\nGerado pro user {user.email} (id {user.id}). TTL {DEFAULT_TTL_DAYS} dias.",
        file=sys.stderr,
    )
    print(
        "Copie a 1ª linha pro .env como INTELLIFORCE_WORKER_TOKEN= e reinicie o worker.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
