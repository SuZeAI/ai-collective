from __future__ import annotations


from server.domain.models import Staff, Department, Task, Message, Analytics


class InMemoryStaffRepository:
    def __init__(self, initial: list[Staff]):
        self._items: dict[str, Staff] = {a.id: a for a in initial}

    def list(self) -> list[Staff]:
        return list(self._items.values())

    def get(self, staff_id: str) -> Staff | None:
        return self._items.get(staff_id)

    def upsert(self, staff: Staff) -> Staff:
        self._items[staff.id] = staff
        return staff

    def delete(self, staff_id: str) -> None:
        self._items.pop(staff_id, None)


class InMemoryDepartmentRepository:
    def __init__(self, initial: list[Department]):
        self._items: dict[str, Department] = {t.id: t for t in initial}

    def list(self) -> list[Department]:
        return list(self._items.values())

    def get(self, department_id: str) -> Department | None:
        return self._items.get(department_id)

    def upsert(self, department: Department) -> Department:
        self._items[department.id] = department
        return department

    def delete(self, department_id: str) -> None:
        self._items.pop(department_id, None)


class InMemoryTaskRepository:
    def __init__(self, initial: list[Task]):
        self._items: dict[str, Task] = {t.id: t for t in initial}

    def list(self) -> list[Task]:
        return list(self._items.values())

    def get(self, task_id: str) -> Task | None:
        return self._items.get(task_id)

    def upsert(self, task: Task) -> Task:
        self._items[task.id] = task
        return task

    def delete(self, task_id: str) -> None:
        self._items.pop(task_id, None)


class InMemoryMeetingRepository:
    def __init__(self, initial: list[Message]):
        self._items: list[Message] = list(initial)

    def list(self, task_id: str | None = None) -> list[Message]:
        if task_id is None:
            return list(self._items)
        return [m for m in self._items if m.task_id == task_id]

    def add(self, message: Message) -> Message:
        self._items.append(message)
        return message


class InMemoryAnalyticsRepository:
    def __init__(self, initial: Analytics):
        self._analytics = initial

    def get(self) -> Analytics:
        return self._analytics

    def set(self, analytics: Analytics) -> Analytics:
        self._analytics = analytics
        return analytics
