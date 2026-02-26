const fs = require("fs");
const path = require("path");

const SECRETS_PATTERNS = [
    /MT[0-9A-Za-z._-]{50,}/g, // Discord Token
    /gsk_[0-9A-Za-z]{40,}/g,   // Groq API Key
];

const IGNORE_FILES = [".env", "node_modules", ".git", "package-lock.json"];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(process.cwd(), filePath);
    let found = false;

    for (const pattern of SECRETS_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
            console.error(`[!] CRITICAL: Found potential secret in ${relativePath}`);
            matches.forEach(m => console.error(`    Match: ${m.substring(0, 5)}...`));
            found = true;
        }
    }
    return found;
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    let issues = 0;

    for (const file of files) {
        if (IGNORE_FILES.includes(file)) continue;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            issues += walkDir(fullPath);
        } else if (file.endsWith(".js") || file.endsWith(".json")) {
            if (scanFile(fullPath)) issues++;
        }
    }
    return issues;
}

console.log("--- NEXUS Security Scanner ---");
const totalIssues = walkDir(process.cwd());

if (totalIssues === 0) {
    console.log("[+] No hardcoded secrets found in monitored files.");
} else {
    console.log(`[!] Scan complete. Found ${totalIssues} files with potential issues.`);
}
