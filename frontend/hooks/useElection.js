'use client';

import { useState, useEffect, useCallback } from 'react';
import { elections as electionsApi } from '../lib/api';
import { VOTE_PAGE_STATES } from '../lib/constants';

export function useElection(electionId) {
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [userStatus, setUserStatus] = useState({ hasVoted: false, receiptToken: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchElection = useCallback(async () => {
    if (!electionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await electionsApi.get(electionId);
      setElection(data.election);
      setCandidates(data.candidates);
      setUserStatus(data.userStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [electionId]);
  
  useEffect(() => {
    fetchElection();
  }, [fetchElection]);
  
  const refetch = useCallback(() => {
    fetchElection();
  }, [fetchElection]);
  
  return {
    election,
    candidates,
    userStatus,
    loading,
    error,
    refetch,
  };
}

export function useElectionState(election, userStatus) {
  const [state, setState] = useState(VOTE_PAGE_STATES.NOT_LOADED);
  
  useEffect(() => {
    if (!election) {
      setState(VOTE_PAGE_STATES.NOT_LOADED);
      return;
    }
    
    if (election.status === 'closed') {
      if (userStatus.hasVoted) {
        setState(VOTE_PAGE_STATES.RESULTS);
      } else {
        setState(VOTE_PAGE_STATES.CLOSED_NO_VOTE);
      }
      return;
    }
    
    if (election.status === 'active') {
      if (userStatus.hasVoted) {
        setState(VOTE_PAGE_STATES.VOTED);
      } else {
        setState(VOTE_PAGE_STATES.VOTING);
      }
      return;
    }
    
    setState(VOTE_PAGE_STATES.NOT_LOADED);
  }, [election, userStatus]);
  
  return [state, setState];
}

export function useVoteSubmission(electionId) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [receiptToken, setReceiptToken] = useState(null);
  
  const submitVote = useCallback(async (candidateId) => {
    if (!electionId || !candidateId) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const result = await electionsApi.vote(electionId, candidateId);
      setReceiptToken(result.receiptToken);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [electionId]);
  
  return {
    submitVote,
    submitting,
    error,
    receiptToken,
  };
}
