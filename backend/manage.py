import asyncio

import typer

from backend.server import (
    AUTO_RUN_MIGRATIONS,
    SEED_ADMIN_ON_STARTUP,
    USE_IN_MEMORY_DB,
    initialize_persistence,
    run_migrations,
    seed_initial_admin,
)

cli = typer.Typer(help="Utility commands for MK-proptech backend maintenance.")


@cli.command()
def migrate() -> None:
    """Apply pending database migrations."""
    if USE_IN_MEMORY_DB:
        typer.echo("In-memory database in use; migrations are skipped.")
        return
    asyncio.run(run_migrations())
    typer.echo("Migrations complete.")


@cli.command()
def seed_admin(
    force: bool = typer.Option(
        False, "--force", "-f", help="Replace existing admin if present."
    )
) -> None:
    """Ensure the initial admin user exists."""
    if USE_IN_MEMORY_DB:
        typer.echo("In-memory database in use; admin seeding is skipped.")
        return
    asyncio.run(seed_initial_admin(force=force))
    typer.echo("Admin seeding complete.")


@cli.command()
def init() -> None:
    """Run migrations and seeders according to environment flags."""
    if USE_IN_MEMORY_DB:
        typer.echo("In-memory database in use; initialization skipped.")
        return
    asyncio.run(initialize_persistence())
    typer.echo(
        "Initialization complete (AUTO_RUN_MIGRATIONS=%s, SEED_ADMIN_ON_STARTUP=%s)"
        % (AUTO_RUN_MIGRATIONS, SEED_ADMIN_ON_STARTUP)
    )


if __name__ == "__main__":
    cli()
