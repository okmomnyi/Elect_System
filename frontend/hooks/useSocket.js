'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const newSocket = io(WS_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('error', () => {});
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  const joinElection = useCallback((electionId) => {
    if (socket && connected) {
      socket.emit('join_election', { electionId });
    }
  }, [socket, connected]);
  
  const leaveElection = useCallback((electionId) => {
    if (socket && connected) {
      socket.emit('leave_election', { electionId });
    }
  }, [socket, connected]);
  
  return {
    socket,
    connected,
    joinElection,
    leaveElection,
  };
}

/**
 * Subscribe to a single election's live tally.
 *
 * @param {string} electionId
 * @param {object} [handlers]
 * @param {(rows: Array<{candidateId: string, votes: number}>) => void} [handlers.onTally]
 *        Fired on `current_tally` (sent when joining the room).
 * @param {(update: {candidateId: string, votes: number}) => void} [handlers.onVote]
 *        Fired on each `vote_update` broadcast.
 */
export function useElectionSocket(electionId, handlers = {}) {
  const { socket, connected, joinElection, leaveElection } = useSocket();
  const [tally, setTally] = useState(null);

  // Keep the latest callbacks in a ref so re-renders don't re-subscribe the
  // socket listeners (which would otherwise detach/attach on every render).
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (connected && electionId) {
      joinElection(electionId);

      return () => {
        leaveElection(electionId);
      };
    }
  }, [connected, electionId, joinElection, leaveElection]);

  useEffect(() => {
    if (!socket) return;

    // Backend `current_tally`: { electionId, results: [{candidateId, votes}], totalVotes }
    const handleCurrentTally = (data) => {
      setTally(data);
      if (Array.isArray(data?.results)) {
        handlersRef.current.onTally?.(data.results);
      }
    };

    // Backend `vote_update`: { candidateId, candidateName, totalVotes } where
    // totalVotes is the new running count for that single candidate.
    const handleVoteUpdate = (data) => {
      if (data?.candidateId == null) return;
      const update = { candidateId: data.candidateId, votes: data.totalVotes };
      handlersRef.current.onVote?.(update);
      setTally((prev) => {
        if (!prev || !Array.isArray(prev.results)) return prev;
        const updatedResults = prev.results.map((r) =>
          r.candidateId === data.candidateId ? { ...r, votes: data.totalVotes } : r
        );
        return {
          ...prev,
          results: updatedResults,
          totalVotes: updatedResults.reduce((sum, r) => sum + (r.votes || 0), 0),
          timestamp: data.timestamp,
        };
      });
    };

    socket.on('current_tally', handleCurrentTally);
    socket.on('vote_update', handleVoteUpdate);

    return () => {
      socket.off('current_tally', handleCurrentTally);
      socket.off('vote_update', handleVoteUpdate);
    };
  }, [socket]);

  return {
    connected,
    tally,
  };
}
