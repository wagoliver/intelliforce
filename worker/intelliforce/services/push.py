"""Envio de Web Push (VAPID) — best-effort, usado pelo Report Center."""
from __future__ import annotations

import json

import structlog
from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select

from intelliforce.db.base import async_session_factory
from intelliforce.db.models.push_subscription import PushSubscription
from intelliforce.settings import get_settings

log = structlog.get_logger()


async def send_report_push(report_id: str, title: str, body: str) -> None:
    """Notifica todos os inscritos sobre um relatório novo. Remove subs mortas."""
    settings = get_settings()
    if not settings.vapid_private_key:
        return

    payload = json.dumps(
        {
            "title": title or "Novo relatório",
            "body": body or "Um novo relatório está disponível.",
            "url": f"/reports/{report_id}",
            "tag": f"report-{report_id}",
        }
    )
    claims = {"sub": settings.vapid_subject}

    async with async_session_factory() as session:
        subs = (await session.execute(select(PushSubscription))).scalars().all()
        dead: list[str] = []
        for s in subs:
            info = {"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}}
            try:
                webpush(
                    subscription_info=info,
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims=dict(claims),
                )
            except WebPushException as e:
                status = getattr(e.response, "status_code", None)
                if status in (404, 410):
                    dead.append(s.endpoint)
                else:
                    log.warning("push.failed", status=status)
            except Exception as e:  # noqa: BLE001
                log.warning("push.error", error=str(e)[:120])

        if dead:
            await session.execute(
                delete(PushSubscription).where(PushSubscription.endpoint.in_(dead))
            )
            await session.commit()
            log.info("push.pruned", count=len(dead))
