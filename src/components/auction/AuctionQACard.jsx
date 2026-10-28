import { useState, useEffect } from 'react';
import { MessageSquare, Send, CheckCircle2, AlertCircle, Loader2, CornerDownRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { getInitials } from '../../lib/utils';

export default function AuctionQACard({ auction }) {
  const { user, isAuthenticated } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [submittingQ, setSubmittingQ] = useState(false);
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submittingA, setSubmittingA] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isSeller = user && auction.seller_id === user.id;

  async function loadQuestions() {
    if (!supabase || !auction?.id) return;
    try {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from('auction_questions')
        .select(`
          *,
          asker:profiles!asker_id(display_name, college)
        `)
        .eq('auction_id', auction.id)
        .order('created_at', { ascending: true });

      if (qErr) throw qErr;
      setQuestions(data || []);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();

    if (!supabase || !auction?.id) return;

    // Realtime subscription for questions on this auction
    const channelName = `auction-qa-${auction.id}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_questions',
          filter: `auction_id=eq.${auction.id}`,
        },
        () => loadQuestions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction?.id]);

  async function handleAskQuestion(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const text = newQuestion.trim();
    if (!text || text.length < 3) {
      setError('Question must be at least 3 characters long.');
      return;
    }

    if (text.length > 1000) {
      setError('Question must not exceed 1000 characters.');
      return;
    }

    if (!isAuthenticated) {
      setError('Please sign in to ask a question.');
      return;
    }

    if (isSeller) {
      setError('Sellers cannot ask questions on their own listing.');
      return;
    }

    try {
      setSubmittingQ(true);
      if (supabase) {
        const { error: insErr } = await supabase
          .from('auction_questions')
          .insert({
            auction_id: auction.id,
            asker_id: user.id,
            question: text,
          });

        if (insErr) throw insErr;
        setNewQuestion('');
        setSuccess('Question posted! The seller will be notified.');
        await loadQuestions();
      } else {
        // Demo fallback
        setQuestions((prev) => [
          ...prev,
          {
            id: `q-${Date.now()}`,
            auction_id: auction.id,
            asker_id: user.id,
            question: text,
            asker: { display_name: user?.user_metadata?.display_name || 'You', college: 'Campus' },
            created_at: new Date().toISOString(),
          },
        ]);
        setNewQuestion('');
        setSuccess('Demo question posted!');
      }
    } catch (err) {
      setError(err.message || 'Failed to post question.');
    } finally {
      setSubmittingQ(false);
    }
  }

  async function handleAnswerQuestion(questionId) {
    setError('');
    setSuccess('');

    const text = answerText.trim();
    if (!text || text.length < 1) {
      setError('Answer cannot be empty.');
      return;
    }

    try {
      setSubmittingA(true);
      if (supabase) {
        const { error: updErr } = await supabase
          .from('auction_questions')
          .update({
            answer: text,
            answered_at: new Date().toISOString(),
          })
          .eq('id', questionId);

        if (updErr) throw updErr;
        setAnswerText('');
        setAnsweringId(null);
        setSuccess('Answer published!');
        await loadQuestions();
      } else {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? { ...q, answer: text, answered_at: new Date().toISOString() }
              : q
          )
        );
        setAnswerText('');
        setAnsweringId(null);
        setSuccess('Demo answer saved!');
      }
    } catch (err) {
      setError(err.message || 'Failed to publish answer.');
    } finally {
      setSubmittingA(false);
    }
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand-600" />
          <h3 className="text-base font-bold text-surface-900">
            Questions & Answers ({questions.length})
          </h3>
        </div>
        <span className="text-xs font-medium text-surface-400">
          Public Discussion
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Ask Question Form (Non-sellers) */}
      {!isSeller && isAuthenticated && (
        <form onSubmit={handleAskQuestion} className="mb-6">
          <div className="relative">
            <textarea
              rows={2}
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ask the seller a question about condition, specs, or handover…"
              className="w-full rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs text-surface-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 placeholder:text-surface-400 resize-none"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-surface-400">
              {newQuestion.length}/1000 characters
            </span>
            <button
              type="submit"
              disabled={submittingQ || !newQuestion.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submittingQ ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Ask Question
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="py-8 text-center text-xs text-surface-400 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
          Loading questions…
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-200 p-6 text-center">
          <p className="text-xs text-surface-500">
            No questions asked yet. Be the first to inquire about this listing!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const askerName = q.asker?.display_name || 'Campus Student';
            const askerCollege = q.asker?.college || 'Campus Member';
            const isAnswering = answeringId === q.id;

            return (
              <div
                key={q.id}
                className="rounded-xl border border-surface-150 bg-surface-50/70 p-4 space-y-3"
              >
                {/* Question */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                      {getInitials(askerName)}
                    </div>
                    <span className="text-xs font-bold text-surface-900">{askerName}</span>
                    <span className="text-[10px] text-surface-400">• {askerCollege}</span>
                  </div>
                  <p className="text-xs text-surface-700 pl-7">{q.question}</p>
                </div>

                {/* Seller Answer */}
                {q.answer ? (
                  <div className="pl-7 pt-2 border-t border-surface-150">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mb-1">
                      <CornerDownRight className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <ShieldCheck className="h-3 w-3" />
                        Seller Response
                      </span>
                    </div>
                    <p className="text-xs text-surface-800 bg-white border border-surface-200 p-3 rounded-xl">
                      {q.answer}
                    </p>
                  </div>
                ) : isSeller ? (
                  /* Seller reply box */
                  <div className="pl-7 pt-2 border-t border-surface-150">
                    {isAnswering ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Type your answer as the listing seller…"
                          className="w-full rounded-xl border border-surface-200 bg-white p-2.5 text-xs text-surface-900 outline-none focus:border-brand-500"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAnswerQuestion(q.id)}
                            disabled={submittingA || !answerText.trim()}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            {submittingA ? 'Publishing…' : 'Publish Answer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAnsweringId(null);
                              setAnswerText('');
                            }}
                            className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-surface-600 hover:bg-surface-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAnsweringId(q.id);
                          setAnswerText('');
                        }}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                      >
                        <CornerDownRight className="h-3.5 w-3.5" />
                        Reply to this question as Seller
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="pl-7 text-[11px] text-surface-400 italic">
                    Awaiting seller reply…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
