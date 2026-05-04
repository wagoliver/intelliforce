"""Models SQLAlchemy do IntelliForce.

Importar aqui é importante pra que o Alembic detecte todos os models
ao gerar migrations.
"""
from intelliforce.db.models.activity import Activity
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.agent_instance import AgentInstance
from intelliforce.db.models.approval import Approval
from intelliforce.db.models.department import Department
from intelliforce.db.models.event import Event
from intelliforce.db.models.secret import Secret
from intelliforce.db.models.secret_access_log import SecretAccessLog
from intelliforce.db.models.squad import Squad
from intelliforce.db.models.task import Task
from intelliforce.db.models.user import User

__all__ = [
    "Activity", "Agent", "AgentInstance", "Approval", "Department",
    "Event", "Secret", "SecretAccessLog", "Squad", "Task", "User",
]
