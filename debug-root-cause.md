# Core Flow Debug — RESOLVED

CTA «Продолжить с выбранной долей» теперь работает корректно.

После нажатия кнопки появляется toast: «Доля забронирована — Вы выбрали 10% Мира на сумму 135 ₽.»

Корневая причина была в пустой таблице planDurations и жёсткой зависимости клиента от plans/durations.
Исправления: repair seed для planDurations, server-side fallback для planId/planDurationId,
убрана жёсткая зависимость клиента от наличия durations.
