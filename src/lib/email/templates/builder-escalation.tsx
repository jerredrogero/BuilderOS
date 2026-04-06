import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Section,
} from "@react-email/components";

interface OverdueItem {
  title: string;
  homeAddress: string;
  daysOverdue: number;
}

interface StuckBuyer {
  email: string;
  homeAddress: string;
  daysSinceInvite: number;
}

interface UpcomingDeadline {
  title: string;
  homeAddress: string;
  daysLeft: number;
}

interface BuilderEscalationEmailProps {
  builderName: string;
  overdueItems: OverdueItem[];
  stuckBuyers: StuckBuyer[];
  upcomingDeadlines: UpcomingDeadline[];
}

export function BuilderEscalationEmail({
  builderName,
  overdueItems,
  stuckBuyers,
  upcomingDeadlines,
}: BuilderEscalationEmailProps) {
  if (
    overdueItems.length === 0 &&
    stuckBuyers.length === 0 &&
    upcomingDeadlines.length === 0
  ) {
    return null;
  }

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            padding: "40px",
          }}
        >
          <Heading
            style={{
              color: "#111827",
              fontSize: "24px",
              fontWeight: "700",
              margin: "0 0 8px",
            }}
          >
            {builderName} — Action Needed
          </Heading>
          <Text style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 32px" }}>
            Weekly digest — items requiring your attention
          </Text>

          {overdueItems.length > 0 && (
            <Section style={{ marginBottom: "28px" }}>
              <Text
                style={{
                  color: "#dc2626",
                  fontSize: "16px",
                  fontWeight: "700",
                  margin: "0 0 12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Overdue Warranty Registrations ({overdueItems.length})
              </Text>
              {overdueItems.map((item, i) => (
                <Text
                  key={i}
                  style={{
                    color: "#374151",
                    fontSize: "14px",
                    margin: "0 0 8px",
                    paddingLeft: "12px",
                    borderLeft: "3px solid #dc2626",
                  }}
                >
                  <strong>{item.title}</strong> — {item.homeAddress} (
                  {item.daysOverdue} day{item.daysOverdue === 1 ? "" : "s"} overdue)
                </Text>
              ))}
            </Section>
          )}

          {stuckBuyers.length > 0 && (
            <Section style={{ marginBottom: "28px" }}>
              <Text
                style={{
                  color: "#d97706",
                  fontSize: "16px",
                  fontWeight: "700",
                  margin: "0 0 12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Buyers Haven't Activated ({stuckBuyers.length})
              </Text>
              {stuckBuyers.map((buyer, i) => (
                <Text
                  key={i}
                  style={{
                    color: "#374151",
                    fontSize: "14px",
                    margin: "0 0 8px",
                    paddingLeft: "12px",
                    borderLeft: "3px solid #d97706",
                  }}
                >
                  <strong>{buyer.email}</strong> — {buyer.homeAddress} (invited{" "}
                  {buyer.daysSinceInvite} day{buyer.daysSinceInvite === 1 ? "" : "s"}{" "}
                  ago)
                </Text>
              ))}
            </Section>
          )}

          {upcomingDeadlines.length > 0 && (
            <Section style={{ marginBottom: "28px" }}>
              <Text
                style={{
                  color: "#2563eb",
                  fontSize: "16px",
                  fontWeight: "700",
                  margin: "0 0 12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Upcoming Deadlines ({upcomingDeadlines.length})
              </Text>
              {upcomingDeadlines.map((deadline, i) => (
                <Text
                  key={i}
                  style={{
                    color: "#374151",
                    fontSize: "14px",
                    margin: "0 0 8px",
                    paddingLeft: "12px",
                    borderLeft: "3px solid #2563eb",
                  }}
                >
                  <strong>{deadline.title}</strong> — {deadline.homeAddress} (
                  {deadline.daysLeft} day{deadline.daysLeft === 1 ? "" : "s"} left)
                </Text>
              ))}
            </Section>
          )}

          <Section style={{ marginTop: "32px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <Text style={{ color: "#9ca3af", fontSize: "12px", margin: "0" }}>
              This is your weekly BuilderOS digest. Log in to your dashboard to take action.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
