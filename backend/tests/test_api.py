"""Core API behaviour tests for the STJ File System."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _create_folder(client: TestClient, name: str, parent_id: int | None = None) -> dict:
    payload: dict = {"name": name}
    if parent_id is not None:
        payload["parent_id"] = parent_id
    response = client.post("/folders", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _create_file(client: TestClient, folder_id: int, name: str) -> dict:
    response = client.post(f"/folders/{folder_id}/files", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_nested_folders_and_file(client: TestClient) -> None:
    root = _create_folder(client, "Documents")
    child = _create_folder(client, "Work", parent_id=root["id"])
    file = _create_file(client, child["id"], "notes.txt")

    folders = client.get("/folders").json()
    files = client.get("/files").json()

    assert len(folders) == 2
    assert len(files) == 1
    assert file["name"] == "notes.txt"
    assert file["folder_id"] == child["id"]


def test_list_endpoints_return_all_rows(client: TestClient) -> None:
    folder = _create_folder(client, "Bulk")
    for index in range(120):
        _create_file(client, folder["id"], f"file-{index:03d}.txt")

    assert len(client.get("/files").json()) == 120


def test_duplicate_file_name_case_insensitive(client: TestClient) -> None:
    folder = _create_folder(client, "Files")
    _create_file(client, folder["id"], "Report.txt")

    response = client.post(f"/folders/{folder['id']}/files", json={"name": "report.txt"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "FILE_ALREADY_EXISTS"


def test_duplicate_folder_name_case_insensitive(client: TestClient) -> None:
    _create_folder(client, "Archive")

    response = client.post("/folders", json={"name": "archive"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "FOLDER_ALREADY_EXISTS"


def test_prefix_search_returns_at_most_ten(client: TestClient) -> None:
    folder = _create_folder(client, "Reports")
    for index in range(15):
        _create_file(client, folder["id"], f"report-{index:02d}.pdf")

    results = client.get("/search", params={"query": "report"}).json()
    assert len(results) == 10
    assert all(name["name"].lower().startswith("report") for name in results)


def test_prefix_search_does_not_match_contains(client: TestClient) -> None:
    folder = _create_folder(client, "Mixed")
    _create_file(client, folder["id"], "report-01.pdf")
    _create_file(client, folder["id"], "my-report.pdf")

    results = client.get("/search", params={"query": "report"}).json()
    names = [item["name"] for item in results]

    assert "report-01.pdf" in names
    assert "my-report.pdf" not in names


def test_prefix_search_full_filename(client: TestClient) -> None:
    folder = _create_folder(client, "Exact")
    _create_file(client, folder["id"], "report-final.pdf")

    results = client.get("/search", params={"query": "report-final.pdf"}).json()
    assert len(results) == 1
    assert results[0]["name"] == "report-final.pdf"


def test_folder_scoped_search_direct_children_only(client: TestClient) -> None:
    parent = _create_folder(client, "Parent")
    child = _create_folder(client, "Child", parent_id=parent["id"])
    _create_file(client, parent["id"], "report-parent.txt")
    _create_file(client, child["id"], "report-child.txt")

    scoped = client.get(
        "/search",
        params={"query": "report", "folder_id": parent["id"]},
    ).json()
    scoped_names = {item["name"] for item in scoped}

    assert "report-parent.txt" in scoped_names
    assert "report-child.txt" not in scoped_names


def test_delete_folder_cascades(client: TestClient) -> None:
    root = _create_folder(client, "Root")
    child = _create_folder(client, "Child", parent_id=root["id"])
    _create_file(client, child["id"], "temp.txt")

    response = client.delete(f"/folders/{root['id']}")
    assert response.status_code == 204
    assert client.get("/folders").json() == []
    assert client.get("/files").json() == []


def test_validation_error_shape(client: TestClient) -> None:
    response = client.post("/folders", json={"name": ""})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
