import { StatusMessage } from './StatusMessage';

export function PickingNotice() {
  return <StatusMessage tone="warn">Point at the element on the page and click it. Press Esc to cancel.</StatusMessage>;
}
