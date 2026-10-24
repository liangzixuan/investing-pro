const readChoices = [
  ["complete", "Complete"],
  ["hold", "Hold captured reply"],
  ["fail", "Fail before reply"],
  ["retire", "Expire session"],
] as const;
const saveChoices = [
  ["complete", "Complete"],
  ["hold", "Commit and hold acknowledgement"],
  ["fail", "Fail before commit"],
  ["lost-ack", "Commit and lose acknowledgement"],
  ["conflict", "Another client advances version"],
  ["retire", "Expire before commit"],
] as const;
interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}
function FailureSelect({
  id,
  label,
  value,
  onChange,
  choices,
}: Props & { choices: readonly (readonly [string, string])[] }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {choices.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}
export function FixtureReadControl(props: Props) {
  return <FailureSelect {...props} choices={readChoices} />;
}
export function FixtureSaveControl(props: Props) {
  return <FailureSelect {...props} choices={saveChoices} />;
}
