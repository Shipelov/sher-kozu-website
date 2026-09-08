# Gallery QA Notes

## Manual smoke-test status

На странице `/animal/marta` удалось подтвердить наличие двух скрытых `input[type="file"]` для загрузки изображений, оба не disabled. Попытка программно инициировать клик по первому input прошла, но `browser_upload_file` на индекс `0` завершился неуспешно без появления нового UI-состояния загрузки или crop-модали.

## Observations

| Check | Result |
| --- | --- |
| AnimalProfile route opens | Yes |
| Existing uploaded photos visible | Yes |
| Reorder controls visible | Yes |
| Hidden file inputs found in DOM | 2 |
| File inputs disabled | No |
| Tool-driven upload succeeded | No |

## Next diagnostic direction

Нужно проверить код `AnimalProfile.tsx`, чтобы понять, можно ли временно упростить upload trigger для надёжного ручного browser QA, либо подтвердить reorder/reload сценарий через уже существующие пользовательские фото без новой загрузки.

## Navigation review observations

| Area | Observation | Risk |
| --- | --- | --- |
| AnimalProfile hero CTA cluster | Три маршрута присутствуют и создают понятный выход в dashboard, tracker и club | Low |
| AnimalProfile lower route cards | Нижний блок повторяет те же три перехода и предотвращает dead-end | Low |
| Gallery upload smoke-test | В DOM есть 2 file input, но автоматизированная browser-upload попытка не сработала на preview | Medium |
| Reorder controls | Кнопки `Влево`/`Вправо` видимы для пользовательских фото, значит сценарий доступен из UI | Low |

## Current conclusion

Навигационно страница AnimalProfile выглядит консистентной: у пользователя есть верхний CTA-кластер и нижний маршрутный блок без тупиков. Основной незавершённый пункт — не логика маршрутов, а надёжность ручного browser smoke-test загрузки через инструмент автоматизации. Если потребуется закрыть этот QA строго в интерфейсе, следующим шагом стоит либо упростить upload-trigger в компоненте, либо проверить сценарий на уже существующих пользовательских фото с ручным reload и reorder без новой загрузки.

## Reorder after reload check

| Check | Result |
| --- | --- |
| Existing uploaded photos visible before reload | Yes |
| Reorder control click executed from browser | Yes |
| Order after reload appears persisted | Inconclusive from browser extraction |
| Reason | Browser text extraction keeps only card titles and does not expose enough structural detail to verify thumbnail swap with confidence |

### Practical reading

Сценарий `reorder -> reload` не показал явного отката данных, но и не дал достаточно надёжного визуального сигнала для строгого утверждения о фактической перестановке только средствами текущего browser extraction. При этом серверный unit test на частичный reorder уже покрыт и проходит.
