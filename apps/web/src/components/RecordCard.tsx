import type { RecordResponse } from '../types'

export default function RecordCard({
  record,
  onConfirm,
}: {
  record: RecordResponse
  onConfirm?: (record: RecordResponse) => void
}) {
  return (
    <div className="card">
      <div className="card-row">
        <span>物品</span>
        <b>{record.item ?? '—'}</b>
      </div>
      <div className="card-row">
        <span>位置</span>
        <b>{record.location ?? '—'}</b>
      </div>
      <div className="card-row">
        <span>存放日期</span>
        <b>{record.placed_at ? record.placed_at.slice(0, 10) : '—'}</b>
      </div>
      <div className="card-row">
        <span>备注</span>
        <b>{record.note ?? '—'}</b>
      </div>
      <div className="card-row">
        <span>置信度</span>
        <b>{(record.confidence * 100).toFixed(0)}%</b>
      </div>
      {record.needs_confirm && <div className="warn">⚠ 低置信度，建议确认</div>}
      {record.needs_confirm && onConfirm && (
        <button className="confirm-btn" onClick={() => onConfirm(record)}>
          确认这条记录
        </button>
      )}
    </div>
  )
}
