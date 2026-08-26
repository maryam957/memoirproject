"""add memory lifecycle tables

Revision ID: 20260824_0001
Revises: 
Create Date: 2026-08-24 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260824_0001"
down_revision = None
branch_labels = None
depends_on = None


memory_status = sa.Enum("draft", "submitted", name="memory_status")
link_type = sa.Enum("primary", "reference", name="memory_link_type")
created_by = sa.Enum("contributor", "owner", "ai", name="memory_link_created_by")


def upgrade() -> None:
    memory_status.create(op.get_bind(), checkfirst=True)
    link_type.create(op.get_bind(), checkfirst=True)
    created_by.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "memoirs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
    )

    op.create_table(
        "memory",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("memoir_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("memoirs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_participant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("status", memory_status, nullable=False, server_default="draft"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_participant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_memory_memoir_id", "memory", ["memoir_id"])

    op.create_table(
        "media_asset",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("memoir_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("memoirs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
    )
    op.create_index("ix_media_asset_memoir_id", "media_asset", ["memoir_id"])

    op.create_table(
        "memory_media",
        sa.Column("memory_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("memory.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("media_asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("media_asset.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("memoir_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("memoirs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("link_type", link_type, nullable=False, server_default="primary"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", created_by, nullable=False, server_default="owner"),
        sa.Column("confirmed_by_owner", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_memory_media_memoir_id", "memory_media", ["memoir_id"])


def downgrade() -> None:
    op.drop_index("ix_memory_media_memoir_id", table_name="memory_media")
    op.drop_table("memory_media")
    op.drop_index("ix_media_asset_memoir_id", table_name="media_asset")
    op.drop_table("media_asset")
    op.drop_index("ix_memory_memoir_id", table_name="memory")
    op.drop_table("memory")
    op.drop_table("memoirs")

    created_by.drop(op.get_bind(), checkfirst=True)
    link_type.drop(op.get_bind(), checkfirst=True)
    memory_status.drop(op.get_bind(), checkfirst=True)
