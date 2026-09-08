"""Calculation tools — accessible to the LLM via function calling."""

spec_calculate_gpa = {
    "type": "function",
    "function": {
        "name": "calculate_gpa",
        "description": "Calculate GPA from letter grades or 0-100 scores. Supports both 4.0 and 5.0 scales. Example input: 'A, B+, A-, 92, 85' or '[{\"grade\": \"A\", \"credits\": 3}, {\"grade\": \"B+\", \"credits\": 4}]'",
        "parameters": {
            "type": "object",
            "properties": {
                "grades": {
                    "type": "string",
                    "description": "Comma-separated grades, or JSON array of {grade, credits} objects",
                },
                "scale": {
                    "type": "number",
                    "description": "GPA scale: 4.0 or 5.0 (default 4.0)",
                },
            },
            "required": ["grades"],
        },
    },
}


def _letter_to_points(grade: str, scale: float) -> float:
    grade = grade.strip().upper()
    if scale == 5.0:
        table = {"A+": 5.0, "A": 4.5, "B+": 4.0, "B": 3.5, "C+": 3.0, "C": 2.5, "D": 2.0, "F": 0}
    else:
        table = {"A+": 4.0, "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7, "C+": 2.3, "C": 2.0, "C-": 1.7, "D+": 1.3, "D": 1.0, "F": 0}
    return table.get(grade, 0)


def handle_calculate_gpa(grades: str = "", scale: float = 4.0, **kwargs) -> str:
    import json

    if not grades:
        return "No grades provided."

    # Try parsing as JSON array of {grade, credits} objects
    try:
        items = json.loads(grades)
        if isinstance(items, list):
            total_pts = 0
            total_credits = 0
            for item in items:
                g = item.get("grade", "")
                c = item.get("credits", 1)
                pts = _letter_to_points(g, scale)
                total_pts += pts * c
                total_credits += c
            if total_credits == 0:
                return "No valid courses to calculate GPA."
            gpa = total_pts / total_credits
            return f"GPA ({scale:.1f} scale): {gpa:.2f} (total credits: {total_credits})"
    except (json.JSONDecodeError, TypeError):
        pass

    # Simple comma-separated grades
    parts = [p.strip() for p in grades.split(",")]
    numeric = True
    values = []
    for p in parts:
        try:
            values.append(float(p))
        except ValueError:
            numeric = False
            break

    if numeric:
        # 0-100 scale
        scaled = [v / 100 * scale for v in values]
        gpa = sum(scaled) / len(scaled)
        return f"GPA ({scale:.1f} scale): {gpa:.2f} (from {len(values)} numeric grades)"
    else:
        # Letter grades
        pts = [_letter_to_points(p, scale) for p in parts]
        non_zero = [p for p in pts if p > 0]
        if not non_zero:
            return "No valid grades found."
        gpa = sum(non_zero) / len(non_zero)
        return f"GPA ({scale:.1f} scale): {gpa:.2f} (from {len(non_zero)} letter grades)"
