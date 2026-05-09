import os
from datetime import datetime
from app.models.crm import Deal

class ReportService:
    """
    Сервис генерации документов (ТКП, Отчеты).
    """

    @staticmethod
    def generate_quotation_html(deal: Deal) -> str:
        """
        Генерирует HTML коммерческого предложения.
        """
        # Базовый стильный шаблон
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }}
                .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }}
                .title {{ font-size: 24px; font-weight: bold; color: #1e3a8a; }}
                .info {{ margin-top: 30px; }}
                .table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                .table th, .table td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                .table th {{ background-color: #f8fafc; font-weight: bold; }}
                .total {{ margin-top: 30px; text-align: right; font-size: 20px; font-weight: bold; color: #3b82f6; }}
                .footer {{ margin-top: 50px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="title">КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</div>
                    <div>№ DEAL-{deal.id} от {datetime.now().strftime('%d.%m.%Y')}</div>
                </div>
                <div style="text-align: right;">
                    <strong>OVERTIME SYSTEM</strong><br/>
                    Системы автоматизации и мониторинга
                </div>
            </div>

            <div class="info">
                <strong>ЗАКАЗЧИК:</strong> {deal.counterparty.name if deal.counterparty else 'Не указан'}<br/>
                <strong>ПРОЕКТ:</strong> {deal.title}<br/>
            </div>

            <p>На основании Вашего запроса, предлагаем рассмотреть коммерческое предложение на реализацию следующих работ:</p>

            <table class="table">
                <thead>
                    <tr>
                        <th>Наименование работ / оборудования</th>
                        <th>Стоимость</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{deal.description or 'Проектирование и пусконаладочные работы'}</td>
                        <td>{deal.budget:,.2f} {deal.currency}</td>
                    </tr>
                    {"<tr><td>Дополнительные расходы</td><td>Включены</td></tr>"}
                </tbody>
            </table>

            <div class="total">
                ИТОГО: {deal.budget:,.2f} {deal.currency}
            </div>

            <div style="margin-top: 40px;">
                <strong>Срок реализации:</strong> 30 рабочих дней<br/>
                <strong>Условия оплаты:</strong> 50% предоплата, 50% по факту завершения работ.
            </div>

            <div class="footer">
                Данное предложение действительно в течение 14 календарных дней.<br/>
                Сгенерировано автоматически системой Overtime CRM.
            </div>
        </body>
        </html>
        """
        return html
