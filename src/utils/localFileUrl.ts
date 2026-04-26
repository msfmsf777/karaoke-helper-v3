export function localPathToFileUrl(filePath?: string | null): string | undefined {
    if (!filePath) return undefined;

    const normalized = filePath.replace(/\\/g, '/');

    if (normalized.startsWith('//')) {
        return `file:${encodeURI(normalized)}`;
    }

    const segments = normalized.split('/').map((segment, index) => {
        if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
            return segment;
        }
        return encodeURIComponent(segment);
    });

    return `file:///${segments.join('/')}`;
}
