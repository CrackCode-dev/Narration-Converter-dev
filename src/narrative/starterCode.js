/**
 * Static fallback starter code templates.
 *
 * Used when the AI generator (starterCodeGenerator.js) fails or is unavailable.
 * Supports two modes per language:
 *   - "function" : callable function only, no main/runner (for judge harness)
 *   - "program"  : full stdin→stdout program with main block
 */

const TEMPLATES = {
    python: {
        function:
`from typing import List

def solve(params):
    """
    TODO: implement solution
    """
    pass
`,
        program:
`import sys

def solve(params):
    """
    TODO: implement solution
    """
    pass

if __name__ == '__main__':
    data = sys.stdin.read().split()
    # TODO: parse input from data
    result = solve(data)
    print(result)
`
    },

    java: {
        function:
`import java.util.*;

public class Main {
    /**
     * TODO: implement solution
     */
    public static Object solve() {
        return null;
    }
}
`,
        program:
`import java.io.*;
import java.util.*;

public class Main {
    /**
     * TODO: implement solution
     */
    public static Object solve() {
        return null;
    }

    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // TODO: parse input
        Object result = solve();
        System.out.println(result);
    }
}
`
    },

    cpp: {
        function:
`#include <bits/stdc++.h>
using namespace std;

// TODO: implement solution
int solve() {
    return 0;
}
`,
        program:
`#include <bits/stdc++.h>
using namespace std;

// TODO: implement solution
int solve() {
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // TODO: parse input
    cout << solve() << endl;
    return 0;
}
`
    },

    javascript: {
        function:
`/**
 * TODO: implement solution
 * @returns {any}
 */
function solve() {
    return null;
}

if (typeof module !== 'undefined') module.exports = solve;
`,
        program:
`'use strict';
const fs = require('fs');

/**
 * TODO: implement solution
 * @returns {any}
 */
function solve() {
    return null;
}

const data = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);
// TODO: parse input from data
const result = solve();
console.log(result);
`
    }
};

/**
 * Get static fallback starter code.
 *
 * @param {string} language - "python" | "java" | "cpp" | "javascript"
 * @param {string} [mode="function"] - "function" | "program"
 * @returns {string} The fallback starter code template
 */
export function getStarterCode(language, mode = "function") {
    const langTemplates = TEMPLATES[language];
    if (!langTemplates) {
        return "// TODO: implement solution\n";
    }

    const validMode = (mode === "function" || mode === "program") ? mode : "function";
    return langTemplates[validMode] || langTemplates.function;
}