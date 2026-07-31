from backend.domain.staff.staff_state import (
    StaffState,
    append_assistant_turn,
    append_user_turn,
    init_staff_states,
    llm_ready_messages,
    merge_staff_states,
    new_staff_state,
)


def test_new_staff_state_seeds_system_message():
    st = new_staff_state(name="Alice", role="Researcher", system_prompt="You are Alice.")
    assert st.messages == ({"role": "system", "content": "You are Alice."},)


def test_llm_messages_strips_system_role():
    st = StaffState(
        name="Alice",
        role="Researcher",
        messages=(
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "u1"},
            {"role": "assistant", "content": "a1"},
        ),
    )
    result = st.llm_messages()
    assert all(m["role"] != "system" for m in result)
    assert result == [{"role": "user", "content": "u1"}, {"role": "assistant", "content": "a1"}]


def test_llm_messages_windows_to_last_n_exchanges():
    messages = [{"role": "system", "content": "sys"}]
    for i in range(20):
        messages.append({"role": "user", "content": f"u{i}"})
        messages.append({"role": "assistant", "content": f"a{i}"})
    st = StaffState(name="Alice", role="Researcher", messages=tuple(messages))

    result = st.llm_messages(window=3)

    assert len(result) == 6
    assert result[0] == {"role": "user", "content": "u17"}
    assert result[-1] == {"role": "assistant", "content": "a19"}


def test_append_user_then_assistant_turn_accumulates():
    states = init_staff_states([_FakeStaff("Alice", "Researcher", "You are Alice.")])

    states = append_user_turn(states, "Alice", "u1")
    states = append_assistant_turn(states, "Alice", "a1")
    states = append_user_turn(states, "Alice", "u2")
    states = append_assistant_turn(states, "Alice", "a2")

    assert states["Alice"].messages == (
        {"role": "system", "content": "You are Alice."},
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "u2"},
        {"role": "assistant", "content": "a2"},
    )


def test_append_user_turn_does_not_mutate_input_dict():
    old = init_staff_states([_FakeStaff("Alice", "Researcher", "sys")])
    old_messages = old["Alice"].messages

    new = append_user_turn(old, "Alice", "x")

    assert old is not new
    assert old["Alice"].messages is old_messages
    assert old["Alice"].messages == ({"role": "system", "content": "sys"},)


def test_get_or_init_returns_existing_without_reset():
    states = init_staff_states([_FakeStaff("Alice", "Researcher", "sys")])
    states = append_user_turn(states, "Alice", "u1")
    states = append_assistant_turn(states, "Alice", "a1")

    still_there = states.get("Alice")

    assert still_there is not None
    assert len(still_there.messages) == 3


def test_merge_staff_states_combines_disjoint_keys():
    a = init_staff_states([_FakeStaff("Alice", "Researcher", "sys-a")])
    b = init_staff_states([_FakeStaff("Bob", "Writer", "sys-b")])

    merged = merge_staff_states(a, b)

    assert set(merged.keys()) == {"Alice", "Bob"}


def test_llm_ready_messages_returns_empty_for_unknown_staff():
    states = init_staff_states([_FakeStaff("Alice", "Researcher", "sys")])
    assert llm_ready_messages(states, "Nobody") == []


class _FakeStaff:
    def __init__(self, name: str, role: str, system_prompt: str):
        self.name = name
        self.role = role
        self.system_prompt = system_prompt
