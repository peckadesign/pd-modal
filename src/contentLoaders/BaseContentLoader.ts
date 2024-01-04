import { PdModal } from '../PdModal'

export class BaseContentLoader {
	protected modal: PdModal

	public constructor(modal: PdModal) {
		this.modal = modal
	}
}
