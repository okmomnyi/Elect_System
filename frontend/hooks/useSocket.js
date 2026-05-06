'use client';

import { useState, useEffect, useCallback } from 'react';
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

export function useElectionSocket(electionId) {
  const { socket, connected, joinElection, leaveElection } = useSocket();
  const [tally, setTally] = useState(null);
  
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
    
    const handleCurrentTally = (data) => {
      setTally(data);
    };
    
    const handleVoteUpdate = (data) => {
      setTally((prev) => {
        if (!prev) return prev;
        
        const updatedResults = prev.results.map((r) => {
          if (r.candidateId === data.candidateId) {
            return { ...r, votes: data.totalVotes };
          }
          return r;
        });
        
        const totalVotes = updatedResults.reduce((sum, r) => sum + r.votes, 0);
        
        return {
          ...prev,
          results: updatedResults,
          totalVotes,
          timestamp: data.timestamp,
        };
      });
    };
    
    const handleElectionClosed = () => {};
    
    socket.on('current_tally', handleCurrentTally);
    socket.on('vote_update', handleVoteUpdate);
    socket.on('election_closed', handleElectionClosed);
    
    return () => {
      socket.off('current_tally', handleCurrentTally);
      socket.off('vote_update', handleVoteUpdate);
      socket.off('election_closed', handleElectionClosed);
    };
  }, [socket]);
  
  return {
    connected,
    tally,
  };
}
