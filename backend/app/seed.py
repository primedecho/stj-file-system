"""Seed the database with demo folders and files for local development."""

import logging

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import File, Folder

logger = logging.getLogger(__name__)

SEARCH_DEMO_FILE_COUNT = 150

# Each cluster: (prefix, count, extensions, folder keys for placement)
FILE_CLUSTERS: list[tuple[str, int, tuple[str, ...], tuple[str, ...]]] = [
    ("report", 22, (".pdf", ".txt", ".md"), ("reports",)),
    ("test", 24, (".txt", ".json", ".log"), ("src", "web_app")),
    ("data", 18, (".csv", ".json", ".xml"), ("documents", "work")),
    ("backup", 14, (".zip", ".tar", ".bak"), ("archive",)),
    ("invoice", 16, (".pdf", ".xlsx"), ("work",)),
    ("log", 14, (".log", ".txt"), ("src", "web_app")),
    ("photo", 14, (".jpg", ".png"), ("photos", "year_2024")),
    ("note", 14, (".txt", ".md"), ("documents", "work")),
    ("config", 14, (".json", ".yaml", ".toml"), ("projects", "web_app", "src")),
]


def _create_folder(db, name: str, parent_id: int | None = None) -> Folder:
    folder = Folder(name=name, parent_id=parent_id)
    db.add(folder)
    db.flush()
    return folder


def _create_file(db, name: str, folder_id: int) -> File:
    file = File(name=name, folder_id=folder_id)
    db.add(file)
    return file


def _build_cluster_filename(prefix: str, index: int, ext: str) -> str:
    variant = index % 5
    if variant == 0:
        return f"{prefix}-{index + 1:03d}{ext}"
    if variant == 1:
        return f"{prefix}-draft-{index + 1}{ext}"
    if variant == 2:
        return f"{prefix}_{index + 1:02d}{ext}"
    if variant == 3:
        return f"{prefix}.v{index + 1}{ext}"
    return f"{prefix}-copy-{index + 1:02d}{ext}"


def _build_search_demo_files() -> list[tuple[str, str]]:
    """Build 150 (filename, folder_key) pairs grouped by shared prefixes."""
    files: list[tuple[str, str]] = []

    for prefix, count, extensions, folder_keys in FILE_CLUSTERS:
        for i in range(count):
            ext = extensions[i % len(extensions)]
            name = _build_cluster_filename(prefix, i, ext)
            folder_key = folder_keys[i % len(folder_keys)]
            files.append((name, folder_key))

    if len(files) != SEARCH_DEMO_FILE_COUNT:
        raise ValueError(
            f"Expected {SEARCH_DEMO_FILE_COUNT} demo files, got {len(files)}"
        )

    names = [name for name, _ in files]
    if len(names) != len(set(names)):
        raise ValueError("Demo filenames must be unique")

    return files


def seed_database() -> None:
    """Populate the database with demo data when it is empty."""
    db = SessionLocal()
    try:
        folder_count = db.scalar(select(func.count()).select_from(Folder)) or 0
        if folder_count > 0:
            logger.debug("Database already contains data — skipping seed")
            return

        logger.info("Seeding database with demo data")

        # Root folders
        documents = _create_folder(db, "Documents")
        projects = _create_folder(db, "Projects")
        photos = _create_folder(db, "Photos")
        archive = _create_folder(db, "Archive")

        # Documents → Work → Reports (3 levels)
        work = _create_folder(db, "Work", parent_id=documents.id)
        reports = _create_folder(db, "Reports", parent_id=work.id)

        # Projects → Web App → src (3 levels)
        web_app = _create_folder(db, "Web App", parent_id=projects.id)
        src = _create_folder(db, "src", parent_id=web_app.id)

        # Photos → 2024 (2 levels)
        year_2024 = _create_folder(db, "2024", parent_id=photos.id)

        folder_by_key = {
            "documents": documents,
            "work": work,
            "reports": reports,
            "projects": projects,
            "web_app": web_app,
            "src": src,
            "photos": photos,
            "year_2024": year_2024,
            "archive": archive,
        }

        demo_files = _build_search_demo_files()
        for filename, folder_key in demo_files:
            folder = folder_by_key[folder_key]
            _create_file(db, filename, folder.id)

        db.commit()
        logger.info(
            "Demo data seeded successfully (%s folders, %s files)",
            len(folder_by_key) + 4,
            len(demo_files),
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to seed database")
        raise
    finally:
        db.close()
