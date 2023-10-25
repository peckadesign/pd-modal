import { ContentLoader, PdModal, PdModalOpener } from '../PdModal'

export class NajaContentLoader implements ContentLoader {
	public matcher(opener: PdModalOpener): boolean {
		return opener === null || opener.dataset.najaModal !== undefined
	}

	public isAsync(): boolean {
		return true
	}

	public openContent(modal: PdModal): boolean {
		if (modal.options.spinner) {
			modal.content.replaceChildren(modal.options.spinner)
		}

		modal.title.innerHTML = modal.i18n[modal.options.language].loading
		modal.title.hidden = false

		return false
	}
}
