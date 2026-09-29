import { StatusMessage } from './StatusMessage';

/**
 * Modern frameworks (React and friends) keep their own state and sometimes
 * ignore input written directly to the DOM. Typing in the field makes the site
 * register the value that is already there.
 */
export function AutofillNotice() {
  return (
    <StatusMessage tone="info">
      Some sites only register input typed by hand. If the form reports a filled field as empty on submit, click into it and type a character - the value is already there and the site accepts it.
    </StatusMessage>
  );
}
