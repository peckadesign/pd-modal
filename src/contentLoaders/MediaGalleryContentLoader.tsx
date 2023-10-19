import { ContentLoader, ContentLoaderListener, PdModal, PdModalOpener } from '../PdModal'
import React from 'jsx-dom'

export type PdModalMediaOptions = {
	i18n?: Record<string, I18nMediaGalleryEntry>
	infinitePager: boolean
	sizes?: string
	thumbnails: boolean
}

export type I18nMediaGalleryEntry = {
	prev: string
	next: string
	showImage: string
	imageOf: string
}

type Relation = {
	modal: PdModal
	opener: HTMLAnchorElement
	mediaElement: HTMLElement
	pages: HTMLAnchorElement[]
	thumbnailsList?: HTMLElement | null
	thumbnails: HTMLAnchorElement[]
	pagesSummary?: HTMLElement
	prev?: HTMLAnchorElement
	next?: HTMLAnchorElement
	relatedOpeners: HTMLAnchorElement[]
	activeIndex: number
	title: string
}

export class MediaGalleryContentLoader implements ContentLoader {
	public imageRegex: RegExp = /(http)?s?:?(\/\/[^"']*\.(?:webp|jpg|jpeg|gif|png|svg))/

	private readonly options: PdModalMediaOptions

	private relation: Relation | null = null

	private readonly pageActiveClass = 'pd-modal__page--active'
	private readonly prevNextDisabledClass = 'pd-modal__page--disabled'
	private readonly thumbnailActiveclass = 'pd-modal__thumbnail-link--active'

	public classList: string[] = ['pd-modal--media']

	public listeners: ContentLoaderListener<any>[] = []

	public readonly i18n: Record<string, I18nMediaGalleryEntry> = {
		en: { prev: 'Previous image', next: 'Next image', showImage: 'Show image', imageOf: 'of' },
		de: { prev: 'Vorheriges Bild', next: 'Nächstes Bild', showImage: 'Bild anzeigen', imageOf: 'von' },
		cs: { prev: 'Předchozí obrázek', next: 'Následující obrázek', showImage: 'Zobrazit obrázek', imageOf: 'z' },
		sk: { prev: 'Predchádzajúca obrázok', next: 'Nasledujúci obrázok', showImage: 'Zobraziť obrázok', imageOf: 'z' }
	}

	private readonly defaults: PdModalMediaOptions = {
		infinitePager: false,
		thumbnails: false
	}

	public constructor(options?: Partial<PdModalMediaOptions>) {
		this.options = { ...this.defaults, ...options }

		if (options && options.i18n) {
			this.i18n = { ...this.i18n, ...options.i18n }
		}

		const keyupListener: ContentLoaderListener<'keyup'> = {
			eventName: 'keyup',
			listener: this.handleKeyUp.bind(this)
		}
		this.listeners.push(keyupListener)
	}

	public matcher(opener: PdModalOpener): boolean {
		if (opener === null) {
			return false
		}

		return (
			opener instanceof HTMLAnchorElement &&
			(opener.dataset.modalMedia !== undefined ||
				opener.dataset.modalIframe !== undefined ||
				opener.dataset.modalRelated !== undefined ||
				this.imageRegex.test(opener.href))
		)
	}

	public isAsync(): boolean {
		return false
	}

	public openContent(modal: PdModal, opener: PdModalOpener): boolean {
		// This method is called only when `matcher` returns `true`, therefore `opener` is always HTMLAnchorElement.
		const openerAnchor = opener as HTMLAnchorElement
		const title = this.getTitle(openerAnchor)

		const mediaElement = this.createMediaElement(modal, openerAnchor, title)

		this.relation = {
			modal: modal,
			opener: openerAnchor,
			mediaElement: mediaElement,
			pages: [],
			thumbnails: [],
			relatedOpeners: this.getRelatedOpeners(modal.options.selector, openerAnchor),
			activeIndex: -1,
			title: title
		}

		// Must be after `this.relation` has been set up
		const pagerElement = this.createPager()
		this.relation.thumbnailsList = this.createThumbnails()

		modal.content.replaceChildren(
			...([pagerElement, mediaElement, this.relation.thumbnailsList].filter((item) => item !== null) as HTMLElement[])
		)

		this.setActivePage(this.relation.relatedOpeners.findIndex((opener) => opener.href === openerAnchor.href))

		modal.setModaltitle(title)

		return false
	}

	private getRelatedOpeners(selector: string, opener: HTMLAnchorElement): HTMLAnchorElement[] {
		const relatedOpeners: HTMLAnchorElement[] = []

		if (opener.dataset.modalRelated === undefined) {
			return relatedOpeners
		}

		document
			.querySelectorAll<HTMLAnchorElement>(`${selector}[data-modal-related="${opener.dataset.modalRelated}"]`)
			.forEach((opener) => {
				// Prevent duplicities in related hrefs, only first occurence is stored
				if (!relatedOpeners.find((rel) => rel.href === opener.href)) {
					relatedOpeners.push(opener)
				}
			})

		return relatedOpeners
	}

	public createThumbnails(): HTMLElement | null {
		const relation = this.relation as Relation

		if (!this.options.thumbnails || relation.relatedOpeners.length === 0) {
			return null
		}

		const thumbnails = (<ul aria-hidden="true" class="pd-modal__thumbnail-list"></ul>) as HTMLUListElement
		const text = this.i18n[this.getLanguage()]

		relation.relatedOpeners.forEach((opener, index) => {
			const thumbnailTitle = this.getTitle(opener)
			const thumbnail = (
				<a
					href={opener.href}
					class="pd-modal__thumbnail-link"
					data-index={index}
					aria-label={`${text.showImage} ${this.getPagesSummaryText(index + 1)}`}
				>
					<img src={opener.dataset.modalThumbnail} class="pd-modal__thumbnail" alt={thumbnailTitle} />
				</a>
			) as HTMLAnchorElement

			relation.thumbnails.push(thumbnail)
			thumbnails.appendChild(<li className="pd-modal__thumbnail-item">{thumbnail}</li>)
		})

		thumbnails.addEventListener('click', this.handlePageClick.bind(this))

		return thumbnails
	}

	private createPager(): HTMLElement | null {
		const relation = this.relation as Relation

		if (relation.relatedOpeners.length === 0) {
			return null
		}

		const pager = (<p class="pd-modal__pager"></p>) as HTMLElement
		const pages = this.createPages()
		const pagesSummary = this.createPagesSummary()
		const { prev, next } = this.createPrevNext()

		pager.replaceChildren(prev, ' ', pages, ' ', pagesSummary, ' ', next)

		return pager
	}

	private createPages(): HTMLElement {
		const relation = this.relation as Relation
		const pages = (<span class="pd-modal__pages"></span>) as HTMLElement
		const text = this.i18n[this.getLanguage()]

		relation.relatedOpeners.forEach((opener, index) => {
			const page = (
				<a
					href={opener.href}
					data-index={index}
					class="pd-modal__page"
					aria-label={`${text.showImage} ${this.getPagesSummaryText(index + 1)}`}
				>
					{index + 1}
				</a>
			) as HTMLAnchorElement

			relation.pages.push(page)
			pages.append(' ', page, ' ')
		})

		pages.addEventListener('click', this.handlePageClick.bind(this))

		return pages
	}

	private createPagesSummary(): HTMLElement {
		const relation = this.relation as Relation
		const pagesSummaryElement = (<span className="pd-modal__pages-summary"></span>) as HTMLElement

		relation.pagesSummary = pagesSummaryElement

		this.updatePagesSummary(relation.activeIndex + 1)

		return pagesSummaryElement
	}

	private updatePagesSummary(activePage: number): void {
		const relation = this.relation as Relation

		if (relation.pagesSummary) {
			relation.pagesSummary.innerText = this.getPagesSummaryText(activePage)
		}
	}

	private getPagesSummaryText(activePage: number): string {
		const relation = this.relation as Relation

		return `${activePage} ${this.i18n[this.getLanguage()].imageOf} ${relation.pages.length}`
	}

	private getLanguage(): string {
		const relation = this.relation as Relation
		const language = relation.modal.options.language

		return this.i18n[language] !== undefined ? language : 'en'
	}

	private createPrevNext(): { prev: HTMLAnchorElement; next: HTMLAnchorElement } {
		const relation = this.relation as Relation
		const language = this.getLanguage()

		const prev = (
			<a href="#" class="pd-modal__page pd-modal__page--prev">
				{this.i18n[language].prev}
			</a>
		) as HTMLAnchorElement

		const next = (
			<a href="#" class="pd-modal__page pd-modal__page--next">
				{this.i18n[language].next}
			</a>
		) as HTMLAnchorElement

		prev.addEventListener('click', this.handlePrevClick.bind(this))
		next.addEventListener('click', this.handleNextClick.bind(this))

		relation.prev = prev
		relation.next = next

		return { prev, next }
	}

	private handlePageClick(event: Event): void {
		event.preventDefault()

		const target: HTMLAnchorElement | null =
			event.target instanceof HTMLAnchorElement ? event.target : (event.target as HTMLElement).closest('a')

		if (!target) {
			return
		}

		const relation = this.relation as Relation
		const index = Number(target.dataset.index)
		const opener = relation.relatedOpeners?.[index]

		if (!opener) {
			return
		}

		relation.modal.element.dataset.modalLoading = 'true'

		this.setActivePage(index)
		this.updateMediaElement(opener)
		relation.modal.setModaltitle(this.getTitle(opener))
	}

	private handlePrevClick(event: Event): void {
		event.preventDefault()

		const relation = this.relation as Relation
		let newActiveIndex = -1

		if (relation.activeIndex > 0) {
			newActiveIndex = relation.activeIndex - 1
		} else if (this.options.infinitePager) {
			newActiveIndex = relation.pages.length - 1
		}

		relation.pages[newActiveIndex]?.click()
	}

	private handleNextClick(event: Event): void {
		event.preventDefault()

		const relation = this.relation as Relation
		let newActiveIndex = -1

		if (relation.activeIndex < relation.pages.length - 1) {
			newActiveIndex = relation.activeIndex + 1
		} else if (this.options.infinitePager) {
			newActiveIndex = 0
		}

		relation.pages[newActiveIndex]?.click()
	}

	private setActivePage(index: number): void {
		const relation = this.relation as Relation

		// Set active page
		relation.pages[relation.activeIndex]?.classList.remove(this.pageActiveClass)
		relation.pages[index]?.classList.add(this.pageActiveClass)

		// Active thumbnail & scroll to it
		relation.thumbnails[relation.activeIndex]?.classList.remove(this.thumbnailActiveclass)
		relation.thumbnails[index]?.classList.add(this.thumbnailActiveclass)
		this.scrollThumbnailIntoView(index)

		// Set disabled classes on prev/next
		relation.prev?.classList.toggle(this.prevNextDisabledClass, index === 0 && !this.options.infinitePager)
		relation.next?.classList.toggle(
			this.prevNextDisabledClass,
			index === relation.pages.length - 1 && !this.options.infinitePager
		)

		// Update current page text
		this.updatePagesSummary(index + 1)

		relation.activeIndex = index
	}

	private scrollThumbnailIntoView(index: number): void {
		const relation = this.relation as Relation

		if (!relation.thumbnailsList || !relation.thumbnails[index]) {
			return
		}

		relation.thumbnailsList.scrollTo({
			top:
				relation.thumbnails[index].offsetTop -
				(relation.thumbnailsList.clientHeight - relation.thumbnails[index].clientHeight) / 2,
			left:
				relation.thumbnails[index].offsetLeft -
				(relation.thumbnailsList.clientWidth - relation.thumbnails[index].clientWidth) / 2,
			behavior: 'auto'
		})
	}

	private updateMediaElement(opener: HTMLAnchorElement): void {
		const relation = this.relation as Relation

		const newMediaElement = this.createMediaElement(relation.modal, opener)
		relation.mediaElement.replaceWith(newMediaElement)
		relation.mediaElement = newMediaElement
	}

	private createMediaElement(modal: PdModal, opener: HTMLAnchorElement, title?: string): HTMLElement {
		const isIframe = opener.dataset.modalIframe !== undefined
		const description = this.getDescription(opener)
		const src = opener.href

		title = title !== undefined ? title : this.getTitle(opener)

		const mediaElement = document.createElement(isIframe ? 'iframe' : 'img')

		mediaElement.addEventListener(
			'load',
			(event: Event) => {
				this.relation?.modal.dispatchLoadEvent(opener, event)
			},
			{ once: true }
		)
		mediaElement.src = src
		mediaElement.classList.add('pd-modal__media')

		if (isIframe) {
			this.setIframeAttributes(mediaElement as HTMLIFrameElement, modal)
		} else {
			this.setImageAttributes(mediaElement as HTMLImageElement, opener, title)
		}

		return (
			<figure class="pd-modal__media-box">
				{mediaElement}
				{description ? <figcaption class="pd-modal__media-caption">{description}</figcaption> : null}
			</figure>
		) as HTMLElement
	}

	private setIframeAttributes(iframe: HTMLIFrameElement, modal: PdModal): void {
		const width = parseFloat(getComputedStyle(modal.content).width)

		iframe.classList.add('pd-modal__media--iframe')

		iframe.allowFullscreen = true
		iframe.width = String(width)
		iframe.height = String(width / (16 / 9))
	}

	private setImageAttributes(image: HTMLImageElement, opener: HTMLAnchorElement, title: string): void {
		const srcset = opener.dataset.modalSrcset
		const sizes = opener.dataset.modalSizes || this.options.sizes

		image.alt = title
		image.classList.add('pd-modal__media--image')

		if (srcset) {
			image.srcset = srcset
		}
		if (srcset && sizes) {
			image.sizes = sizes
		}
	}

	private getTitle(opener: HTMLAnchorElement): string {
		return opener.dataset.modalTitle || opener.querySelector('img')?.alt || opener.title
	}

	private getDescription(opener: HTMLAnchorElement): string | undefined {
		return opener.dataset.modalDescription || opener.querySelector('img')?.title
	}

	private handleKeyUp(event: KeyboardEvent): void {
		if (event.key === 'ArrowLeft') {
			this.handlePrevClick(event)
		} else if (event.key === 'ArrowRight') {
			this.handleNextClick(event)
		}
	}
}
