# Korea_road_Bridges_Tunnels

대한민국 도로 인프라(교량·터널·지하차도)의 공개 현황 데이터를 정리하고, 웹 대시보드로 시각화하는 프로젝트입니다.

- **자료 기준:** 2024년 말 조사 (2025년 제공)
- **원자료:** `data/raw/2025_도로_교량_및_터널현황조서.xls` 및 시설별 CSV
- **웹 대시보드:** `docs/` (교량·터널·지하차도 페이지)

## 데이터

`data/raw/`에 시설 종류별 원자료 CSV가 있습니다.

| 파일 | 시설 | 레코드 수(대략) |
| --- | --- | --- |
| `Bridges.csv` | 교량 | 약 40,000 |
| `Tunnels.csv` | 터널 | 약 36,500 |
| `Underpasses.csv` | 지하차도 | 약 36,500 |

공통 항목은 도로종류, 노선명, 시설명, 시도/시군구/읍면동/리, 총길이, 총폭, 유효폭, 높이, 교통량, 기관구분, 준공년도 등입니다. 시설별 세부 항목(예: 교량의 경간수·상부구조·설계하중)은 `tools/schema_v2.*.yaml`에 정의되어 있습니다.

## 저장소 구조

```
data/
  raw/        # 원자료 (xls, csv)
  processed/  # 가공 중간 산출물
  lookup/     # 코드/명칭 매핑
docs/         # 정적 웹 대시보드
  index.html          # 시설 종류 선택 랜딩 페이지
  bridges.html        # 교량 대시보드
  tunnels.html        # 터널 대시보드
  underpasses.html    # 지하차도 대시보드
  data/*.min.json     # 대시보드가 읽는 변환 결과
tools/
  convert_csv_to_json_v2.py   # CSV → JSON 변환 스크립트
  schema_v2.*.yaml            # 시설별 컬럼 매핑 스키마
```

## 데이터 변환

`tools/convert_csv_to_json_v2.py`는 `data/raw/`의 CSV를 스키마(`tools/schema_v2.*.yaml`)에 따라 매핑하여 `docs/data/*.min.json`으로 변환합니다. 각 레코드에는 `id_prefix` 기반의 고유 `id`가 부여됩니다.

```bash
pip install pandas pyyaml
python tools/convert_csv_to_json_v2.py
```

원자료가 다양한 인코딩(UTF-8, CP949, EUC-KR)으로 저장돼 있어도 스크립트가 자동으로 처리합니다.

## 웹 대시보드

`docs/`는 별도 빌드 없이 동작하는 정적 사이트입니다. 로컬에서 확인하려면:

```bash
python -m http.server 8000 --directory docs
# 브라우저에서 http://localhost:8000 접속
```

## 라이선스

원자료의 출처와 이용 조건을 따릅니다.
