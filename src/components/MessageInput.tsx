import { useMutation } from 'convex/react';
import { KeyboardEvent, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSendInput } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { Conversation } from '../../convex/aiTown/conversation';

export function MessageInput({
  worldId,
  engineId,
  humanPlayer,
  conversation,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  humanPlayer: Player;
  conversation: Conversation;
}) {
  const inputRef = useRef<HTMLParagraphElement>(null);
  const inflightUuid = useRef<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  const writeMessage = useMutation(api.messages.writeMessage);
  const startTyping = useSendInput(engineId, 'startTyping');
  const currentlyTyping = conversation.isTyping;

  const sendMessage = async () => {
    if (!inputRef.current || isSending) {
      return;
    }
    const text = inputRef.current.innerText.trim();
    if (!text) {
      return;
    }

    let messageUuid = inflightUuid.current;
    if (currentlyTyping && currentlyTyping.playerId === humanPlayer.id) {
      messageUuid = currentlyTyping.messageUuid;
    }
    messageUuid = messageUuid || crypto.randomUUID();
    setIsSending(true);
    try {
      await writeMessage({
        worldId,
        playerId: humanPlayer.id,
        conversationId: conversation.id,
        text,
        messageUuid,
      });
      if (inputRef.current) {
        inputRef.current.innerText = '';
      }
    } finally {
      setIsSending(false);
    }
  };

  const onKeyDown = async (e: KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
      return;
    }

    if (currentlyTyping || inflightUuid.current !== undefined) {
      return;
    }
    inflightUuid.current = crypto.randomUUID();
    try {
      // Typing state is transient, so a failed update should not interrupt composing.
      await startTyping({
        playerId: humanPlayer.id,
        conversationId: conversation.id,
        messageUuid: inflightUuid.current,
      });
    } finally {
      inflightUuid.current = undefined;
    }
  };

  return (
    <div className="town-chat-composer">
      <p
        className="town-chat-input"
        ref={inputRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Message"
        tabIndex={0}
        placeholder="Type a message..."
        onKeyDown={(event) => void onKeyDown(event)}
      />
      <button
        type="button"
        className="town-chat-send"
        disabled={isSending}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => void sendMessage()}
      >
        {isSending ? 'Sending' : 'Send'}
      </button>
    </div>
  );
}
