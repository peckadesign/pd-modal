export function isBodyOverflowing(): boolean {
	const rect = document.body.getBoundingClientRect()

	return rect.left + rect.right < window.innerWidth
}

export function isElementOverflowing(element: Element): boolean {
	return element && element.scrollHeight > document.documentElement.clientHeight
}

export function kebabize(str: string): string {
	return str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase())
}

export function toArray<T>(value?: T | T[]): T[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

export function isNonEmptyToken(token: unknown): token is string {
	return typeof token === 'string' && token.length > 0 && /^\S+$/.test(token)
}

export function toggleClasses(element: HTMLElement | undefined, classes: string | string[], force?: boolean): void {
	if (!element) {
		return
	}

	const tokens = toArray(classes).filter(isNonEmptyToken)

	tokens.forEach((token) => element.classList.toggle(token, force))
}

export function getFunction(name: string, scope: any): any {
	const pieces = name.split('.')
	let current = scope

	for (let i = 0; i < pieces.length; i++) {
		if (pieces[i] in current) {
			current = current[pieces[i]]
		} else {
			return null
		}
	}

	return typeof current === 'function' ? current : null
}

// typed EventTarget
type TypedEventListenerFunction<ET extends EventTarget, E extends Event> = (
	this: ET,
	event: E
) => boolean | void | Promise<void>

type TypedEventListenerObject<E extends Event> = {
	handleEvent(event: E): void | Promise<void>
}

export type TypedEventListener<ET extends EventTarget, E extends Event> =
	| TypedEventListenerFunction<ET, E>
	| TypedEventListenerObject<E>
	| null
