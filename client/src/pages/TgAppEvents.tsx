/**
 * Telegram Mini App — Club Events screen
 * Shows upcoming and past club events.
 */

import TelegramMiniAppLayout from "@/components/TelegramMiniAppLayout";
import { useTelegram } from "@/contexts/TelegramContext";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  CalendarDays,
  MapPin,
  Users,
  Clock,
} from "lucide-react";

export default function TgAppEvents() {
  const { webApp } = useTelegram();

  const { data: feedData, isLoading } = trpc.club.feed.useQuery(undefined, {
    retry: 1,
  });

  if (isLoading) {
    return (
      <TelegramMiniAppLayout title="События клуба">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#1a3a2a]" />
        </div>
      </TelegramMiniAppLayout>
    );
  }

  const events = (feedData as any)?.events ?? [];

  if (!events.length) {
    return (
      <TelegramMiniAppLayout title="События клуба">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
          <CalendarDays className="h-12 w-12 text-[#1a3a2a]/20" />
          <p className="text-sm text-[#1a3a2a]/60">
            Событий пока нет. Следите за обновлениями!
          </p>
        </div>
      </TelegramMiniAppLayout>
    );
  }

  // Sort by date, upcoming first
  const now = Date.now();
  const sorted = [...events].sort((a: any, b: any) => {
    const dateA = new Date(a.eventDate || a.date || 0).getTime();
    const dateB = new Date(b.eventDate || b.date || 0).getTime();
    const aUpcoming = dateA >= now;
    const bUpcoming = dateB >= now;
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    return aUpcoming ? dateA - dateB : dateB - dateA;
  });

  return (
    <TelegramMiniAppLayout title="События клуба">
      <div className="px-4 pt-4 space-y-3 pb-4">
        {sorted.map((event: any, i: number) => {
          const eventDate = event.eventDate || event.date;
          const isPast = eventDate && new Date(eventDate).getTime() < now;

          return (
            <div
              key={event.id || i}
              className={`bg-white rounded-2xl overflow-hidden shadow-sm ${
                isPast ? "opacity-60" : ""
              }`}
            >
              {/* Event image */}
              {event.imageUrl && (
                <div className="w-full aspect-[2.5/1] overflow-hidden">
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-4">
                {/* Badge */}
                {!isPast && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-2">
                    Предстоящее
                  </span>
                )}
                {isPast && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full mb-2">
                    Прошедшее
                  </span>
                )}

                <h3 className="text-sm font-semibold text-[#1a3a2a]">
                  {event.title}
                </h3>

                {event.description && (
                  <p className="text-xs text-[#1a3a2a]/60 mt-1 line-clamp-2">
                    {event.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 mt-3">
                  {eventDate && (
                    <div className="flex items-center gap-1 text-[10px] text-[#1a3a2a]/50">
                      <Clock className="h-3 w-3" />
                      {new Date(eventDate).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-1 text-[10px] text-[#1a3a2a]/50">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                  )}
                  {event.maxParticipants && (
                    <div className="flex items-center gap-1 text-[10px] text-[#1a3a2a]/50">
                      <Users className="h-3 w-3" />
                      {event.registrationCount ?? 0}/{event.maxParticipants}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </TelegramMiniAppLayout>
  );
}
