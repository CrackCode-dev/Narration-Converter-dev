export function getStarterCode(language) {
  // easy to extend later: add a new case
  switch (language) {
    case "python":
      return "def solve():\n    # TODO: implement solution\n    pass\n\nif __name__ == '__main__':\n    solve()\n";
    case "java":
      return "import java.util.*;\n\nclass Main {\n  public static void main(String[] args) {\n    // TODO: implement solution\n  }\n}\n";
    case "cpp":
      return "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  // TODO: implement solution\n  return 0;\n}\n";
    case "javascript":
      return "function solve(input) {\n  // TODO: implement solution\n  return '';\n}\n";
    default:
      // future language fallback
      return "// TODO: implement solution\n";
  }
}
