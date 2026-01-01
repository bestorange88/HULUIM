import React, { useRef } from 'react';
import CallInterface from './CallInterface';
import IncomingCallDialog from './IncomingCallDialog';
import { useCall } from '@/contexts/CallContext';
import { supabase } from '@/integrations/supabase/client';

const GlobalCallManager: React.FC = () => {
  const { callState, incomingCall, acceptCall, rejectCall, endCall, cancelCall } = useCall();
  const callRecordSavedRef = useRef(false);

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Save call record to messages
  const saveCallRecord = async (
    conversationId: string,
    callType: 'audio' | 'video',
    duration: number,
    wasConnected: boolean
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const callTypeText = callType === 'video' ? '视频通话' : '语音通话';
      let content: string;
      
      if (wasConnected) {
        content = `[${callTypeText}] 通话时长 ${formatDuration(duration)}`;
      } else {
        content = `[${callTypeText}] 未接通`;
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content,
        type: 'text'
      });

      console.log('[GlobalCallManager] Call record saved:', content);
    } catch (error) {
      console.error('[GlobalCallManager] Error saving call record:', error);
    }
  };

  const handleEndCall = async (duration: number, wasConnected: boolean) => {
    // Prevent duplicate call records
    if (callRecordSavedRef.current) {
      console.log('[GlobalCallManager] Call record already saved, skipping');
      endCall();
      callRecordSavedRef.current = false; // Reset immediately for next call
      return;
    }
    
    // Only the caller (initiator) saves the call record
    if (callState.conversationId && callState.callType && callState.isInitiator) {
      callRecordSavedRef.current = true;
      try {
        await saveCallRecord(
          callState.conversationId,
          callState.callType,
          duration,
          wasConnected
        );
      } catch (error) {
        console.error('[GlobalCallManager] Error saving call record:', error);
      }
    }
    endCall();
    // Reset for next call
    callRecordSavedRef.current = false;
  };

  const handleCancelCall = async () => {
    // Prevent duplicate call records
    if (callRecordSavedRef.current) {
      console.log('[GlobalCallManager] Call record already saved, skipping');
      cancelCall();
      callRecordSavedRef.current = false; // Reset immediately for next call
      return;
    }
    
    // Only the caller (initiator) saves the call record
    if (callState.conversationId && callState.callType && callState.isInitiator) {
      callRecordSavedRef.current = true;
      try {
        await saveCallRecord(
          callState.conversationId,
          callState.callType,
          0,
          false
        );
      } catch (error) {
        console.error('[GlobalCallManager] Error saving call record:', error);
      }
    }
    cancelCall();
    // Reset for next call
    callRecordSavedRef.current = false;
  };

  return (
    <>
      {/* Active Call Interface */}
      {callState.isInCall && callState.conversationId && callState.callType && callState.otherUser && callState.invitationId && (
        <CallInterface
          conversationId={callState.conversationId}
          callType={callState.callType}
          isInitiator={callState.isInitiator}
          invitationId={callState.invitationId}
          onEndCall={handleEndCall}
          onCancelCall={handleCancelCall}
          otherUser={callState.otherUser}
        />
      )}

      {/* Incoming Call Dialog - Shows on any page */}
      {incomingCall && !callState.isInCall && (
        <IncomingCallDialog
          isOpen={!!incomingCall}
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}
    </>
  );
};

export default GlobalCallManager;
