"""Camada de eventos — backbone event-driven do IntelliForce."""
from intelliforce.events.bus import EventBus
from intelliforce.events.publisher import OutboxPublisher
from intelliforce.events.subscriber import EventSubscriber

__all__ = ["EventBus", "OutboxPublisher", "EventSubscriber"]
