import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Safely parse JSON with comments and trailing commas.
 *
 * This regex-based approach succeeds a `node:vm` `runInNewContext` based approach, which was susceptible to arbitrary code execution and VM edge-case syntax failures.
 * It could be argued that because `devcontainer.json` is a trusted file in the workspace context, it is safe to use `runInNewContext` to parse it. However, the regex approach is more robust and avoids potential security risks.
 *
 * @param {string} content Raw JSONC string.
 * @returns {any} Parsed JSON object.
 */
function parseJsonc(content) {
    // Strip single-line and multi-line comments as well as trailing commas for `devcontainer.json` parsing.
    const stripped = content
        .replaceAll(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gmu, '$1')
        .replaceAll(/,\s*([\]}])/gu, '$1');
    return JSON.parse(stripped);
}

async function findDevcontainerProjectName(candidateDirs) {
    for (const dir of candidateDirs) {
        for (const devcontainerFileName of ['.devcontainer/devcontainer.json', 'devcontainer.json']) {
            try {
                const devcontainerJsonContents = await readFile(path.join(dir, devcontainerFileName), 'utf8');
                const devcontainerJsonObj = parseJsonc(devcontainerJsonContents);

                if ((typeof devcontainerJsonObj?.name === 'string') && devcontainerJsonObj.name.trim()) {
                    return devcontainerJsonObj.name.trim();
                }
            }
            catch { /* Ignore unreadable or invalid `devcontainer.json` files. */ }
        }
    }
}

async function findPackageJsonProjectName(candidateDirs) {
    for (const dir of candidateDirs) {
        try {
            const packageJsonContents = await readFile(path.join(dir, 'package.json'), 'utf8');
            const packageJsonObj = JSON.parse(packageJsonContents);

            if ((typeof packageJsonObj?.name === 'string') && packageJsonObj.name.trim()) {
                return packageJsonObj.name.trim();
            }
        }
        catch { /* Ignore unreadable or invalid `package.json` files. */ }
    }
}

async function findGitRepositoryProjectName(candidateDirs) {
    for (const dir of candidateDirs) {
        try {
            const gitEntryPath = path.join(dir, '.git');
            const gitEntryStats = await stat(gitEntryPath);

            let gitConfigPath;
            if (gitEntryStats.isDirectory()) gitConfigPath = path.join(gitEntryPath, 'config');
            else if (gitEntryStats.isFile()) {
                const gitPointerContents = await readFile(gitEntryPath, 'utf8');
                const gitDirMatch = gitPointerContents.match(/^gitdir:\s*(.+)\s*$/mu);
                if (gitDirMatch) gitConfigPath = path.resolve(dir, gitDirMatch[1], 'config');
            }

            const gitConfigContents = gitConfigPath ? await readFile(gitConfigPath, 'utf8') : '';
            const repositoryUrl = gitConfigContents.match(/\[remote "origin"\][\s\S]*?^\s*url\s*=\s*(.+)\s*$/mu)?.[1] ?? gitConfigContents.match(/^\s*url\s*=\s*(.+)\s*$/mu)?.[1];
            // Strip trailing slashes before matching repository basename so URLs ending in `/` (e.g. "https://github.com/org/repo/") do not yield an empty string.
            const cleanUrl = repositoryUrl?.trim().replace(/\/+$/u, '');
            const repositoryName = cleanUrl?.match(/([^/:]+?)(?:\.git)?$/u)?.[1];

            return repositoryName || path.basename(dir);
        }
        catch { /* Ignore unreadable or invalid `git` configurations. */ }
    }
}

/**
 * Resolve a stable archive label for the host-trust bundle from the current project context.
 *
 * Order of precedence for determining the project name:
 * 1. The "name" field in the nearest `devcontainer.json` file in the current or ancestor directories.
 * 2. The "name" field in the nearest `package.json` file in the current or ancestor directories.
 * 3. The repository name from the nearest `git` repository in the current or ancestor directories.
 *
 * @param {string} [rootDir=process.cwd()] The root directory to start searching for project context files.
 * @returns {Promise<string>} A sanitized project name suitable for use in archive file names.
 */
export async function resolveArchiveProjectName(rootDir = process.cwd()) {
    // Walk up the directory tree from `rootDir` to find candidate project names from `devcontainer.json`, `package.json`, or `git` config.
    const candidateDirs = [];
    let candidateDir = path.resolve(rootDir);
    while (true) {
        candidateDirs.push(candidateDir);
        const parentDir = path.dirname(candidateDir);
        if (parentDir === candidateDir) break;
        candidateDir = parentDir;
    }

    const projectName = await findDevcontainerProjectName(candidateDirs)
        ?? await findPackageJsonProjectName(candidateDirs)
        ?? await findGitRepositoryProjectName(candidateDirs)
        ?? 'untitled';

    // Sanitize the project name to be filesystem-friendly and avoid issues with special characters in archive names.
    const sanitizedName = [...projectName]
        .map(char => (char.codePointAt(0) <= 31) ? '-' : char)
        .join('')
        .replaceAll(/[<>:"/\\|?*]/gu, '-')
        .replaceAll(/[. ]+$/gu, '')
        .trim();

    // Default to "untitled" if sanitization stripped all characters (e.g., input was entirely invalid filesystem symbols) to prevent malformed archive names like "-CA-...zip".
    return sanitizedName || 'untitled';
}
