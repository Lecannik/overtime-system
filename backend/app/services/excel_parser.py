import pandas as pd
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class ExcelParser:
    """
    Сервис автоматического парсинга финансовых показателей из спецификаций Excel.
    """

    @staticmethod
    def parse_project_spec(file_path: str) -> Dict[str, float]:
        """
        Ищет финансовые показатели в файле excel по ключевым словам.
        """
        try:
            xl = pd.ExcelFile(file_path)
            data = {}
            
            mapping = {
                "валовая прибыль": "gross_profit",
                "чистая прибыль": "net_profit",
                "оборот": "turnover",
                "сумма работ": "labor_cost",
                "нтк": "ntk",
                "ауп": "aup",
                "бюджет": "budget"
            }

            # 1. Приоритетный поиск в 'svod_AllWIN'
            if 'svod_AllWIN' in xl.sheet_names:
                df_svod = xl.parse('svod_AllWIN')
                for keyword, field in mapping.items():
                    res = ExcelParser._find_value_by_keyword(df_svod, keyword)
                    if res:
                        data[field] = res

            # 2. Поиск в 'Commerce' (Оборот)
            if 'Commerce' in xl.sheet_names:
                df_comm = xl.parse('Commerce')
                res = ExcelParser._find_value_by_keyword(df_comm, "итого")
                if res and "turnover" not in data:
                    data["turnover"] = res

            # 3. Общий поиск по всем листам (fallback)
            if not data:
                for sheet_name in xl.sheet_names:
                    df = xl.parse(sheet_name)
                    for keyword, field in mapping.items():
                        if field in data:
                            continue
                        res = ExcelParser._find_value_by_keyword(df, keyword)
                        if res:
                            data[field] = res
            
            logger.info(f"Парсинг спецификации завершен: найдено {len(data)} показателей — {data}")
            return data
            
        except Exception as e:
            logger.error(f"Ошибка при парсинге спецификации {file_path}: {e}", exc_info=True)
            return {}

    @staticmethod
    def parse_gantt_excel(file_path: str) -> List[Dict[str, Any]]:
        """
        Парсит Excel-файл с данными для диаграммы Ганта.
        Ожидаемые колонки: Задача/Название, Начало, Окончание/Конец, Исполнитель (опционально).
        Возвращает список словарей с ключами: title, start_date, end_date, assignee.
        """
        try:
            xl = pd.ExcelFile(file_path)
            df = xl.parse(xl.sheet_names[0])  # Берём первый лист
            
            # Маппинг возможных названий колонок
            col_mapping = {}
            for col in df.columns:
                col_lower = str(col).lower().strip()
                if any(k in col_lower for k in ['задач', 'назван', 'наименование', 'title', 'name', 'работ']):
                    col_mapping['title'] = col
                elif any(k in col_lower for k in ['начал', 'старт', 'start', 'дата начала', 'нач.']):
                    col_mapping['start_date'] = col
                elif any(k in col_lower for k in ['оконч', 'конец', 'end', 'finish', 'дата окончания', 'завершен']):
                    col_mapping['end_date'] = col
                elif any(k in col_lower for k in ['исполнител', 'ответственн', 'assignee', 'сотрудник']):
                    col_mapping['assignee'] = col
            
            if 'title' not in col_mapping or 'start_date' not in col_mapping:
                logger.warning(f"Не найдены обязательные колонки. Найденные: {col_mapping}. Колонки файла: {list(df.columns)}")
                return []
            
            tasks = []
            for _, row in df.iterrows():
                title = str(row.get(col_mapping['title'], '')).strip()
                if not title or title == 'nan':
                    continue
                
                start_date = row.get(col_mapping.get('start_date'))
                end_date = row.get(col_mapping.get('end_date'))
                assignee = str(row.get(col_mapping.get('assignee', ''), '')).strip()
                
                # Парсинг дат
                try:
                    if isinstance(start_date, str):
                        start_date = pd.to_datetime(start_date, dayfirst=True)
                    else:
                        start_date = pd.to_datetime(start_date)
                except:
                    continue
                
                try:
                    if end_date is not None and str(end_date) != 'nan':
                        if isinstance(end_date, str):
                            end_date = pd.to_datetime(end_date, dayfirst=True)
                        else:
                            end_date = pd.to_datetime(end_date)
                    else:
                        end_date = start_date + pd.Timedelta(days=7)
                except:
                    end_date = start_date + pd.Timedelta(days=7)
                
                tasks.append({
                    'title': title,
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'assignee': assignee if assignee != 'nan' else ''
                })
            
            logger.info(f"Gantt Excel: найдено {len(tasks)} задач")
            return tasks
            
        except Exception as e:
            logger.error(f"Ошибка при парсинге Gantt Excel {file_path}: {e}", exc_info=True)
            return []

    @staticmethod
    def _find_value_by_keyword(df: pd.DataFrame, keyword: str) -> float | None:
        """Вспомогательный метод для поиска значения рядом с ключевым словом."""
        try:
            df_str = df.astype(str).map(lambda x: x.lower())
            mask = df_str.apply(lambda s: s.str.contains(keyword, na=False))
            if mask.any().any():
                coords = mask.values.nonzero()
                row_idx, col_idx = coords[0][0], coords[1][0]
                for offset in range(1, 6):
                    if col_idx + offset >= df.shape[1]:
                        break
                    val = df.iloc[row_idx, col_idx + offset]
                    if isinstance(val, (int, float)) and not pd.isna(val):
                        return round(float(val), 2)
                    if isinstance(val, str):
                        cleaned_val = "".join(filter(lambda x: x.isdigit() or x in ".,", val)).replace(",", ".")
                        if cleaned_val:
                            try:
                                return round(float(cleaned_val), 2)
                            except:
                                pass
        except:
            pass
        return None
