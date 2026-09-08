"""API tests for /meetings (task chat messages)."""

from __future__ import annotations

from conftest import API, make_department, make_task


def _make_task(client, headers) -> dict:
    department = make_department(client, headers)
    return make_task(client, headers, department_id=department["id"], title="Task with messages")


def test_post_and_list_messages_scoped_to_task_id(client, user_headers):
    task = _make_task(client, user_headers)

    resp = client.post(
        f"{API}/meetings",
        json={"taskId": task["id"], "staffId": "user", "content": "hello team"},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    message = resp.json()
    assert message["taskId"] == task["id"]

    listed = client.get(f"{API}/meetings", params={"task_id": task["id"]}, headers=user_headers)
    assert listed.status_code == 200
    ids = [m["id"] for m in listed.json()]
    assert message["id"] in ids


def test_messages_for_unknown_task_id_return_404(client, user_headers):
    resp = client.get(f"{API}/meetings", params={"task_id": "task_does_not_exist"}, headers=user_headers)
    assert resp.status_code == 404


def test_cannot_post_message_to_someone_elses_task(client, user_headers, second_user_headers):
    task = _make_task(client, user_headers)

    resp = client.post(
        f"{API}/meetings",
        json={"taskId": task["id"], "staffId": "user", "content": "intruding", "role": "user"},
        headers=second_user_headers,
    )
    assert resp.status_code == 404
