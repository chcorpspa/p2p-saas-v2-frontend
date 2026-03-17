'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function BotsPage() {
  const qc = useQueryClient();
  const socket = useSocket();

  const { data: bots = [] } = useQuery({
    queryKey: ['bots'],
    queryFn: () => api.get('/bots').then(r => r.data),
  });

  const startBot = useMutation({
    mutationFn: (id: string) => api.post(`/bots/${id}/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bots'] }),
  });

  const stopBot = useMutation({
    mutationFn: (id: string) => api.post(`/bots/${id}/stop`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bots'] }),
  });

  useEffect(() => {
    if (!socket) return;
    const onTick = () => qc.invalidateQueries({ queryKey: ['bots'] });
    const onError = () => qc.invalidateQueries({ queryKey: ['bots'] });
    socket.on('bot:tick', onTick);
    socket.on('bot:error', onError);
    return () => {
      socket.off('bot:tick', onTick);
      socket.off('bot:error', onError);
    };
  }, [socket, qc]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bots</h1>
      <div className="grid gap-4">
        {bots.map((bot: any) => (
          <div key={bot.id} className="border rounded p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{bot.advNo}</p>
              <p className="text-sm text-muted-foreground">{bot.account?.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={bot.status === 'RUNNING' ? 'default' : 'secondary'}>{bot.status}</Badge>
              {bot.status === 'RUNNING'
                ? <Button size="sm" variant="outline" onClick={() => stopBot.mutate(bot.id)} disabled={stopBot.isPending}>Stop</Button>
                : <Button size="sm" onClick={() => startBot.mutate(bot.id)} disabled={startBot.isPending}>Start</Button>
              }
            </div>
          </div>
        ))}
        {bots.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No bots configured yet.</p>
        )}
      </div>
    </div>
  );
}
