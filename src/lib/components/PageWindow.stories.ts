import type { Meta, StoryObj } from '@storybook/sveltekit';
import PageWindow from '#lib/components/PageWindow.svelte';

const LOGIN =
	'http://localhost:18080/realms/demo/protocol/openid-connect/auth?response_type=code&client_id=demo-app&redirect_uri=http%3A%2F%2Flocalhost%3A9100%2Fcallback&state=1yQP5MIhi3s3KYua5nVyzA';
const CALLBACK =
	'http://localhost:9100/callback?state=1yQP5MIhi3s3KYua5nVyzA&session_state=QuW3mmu5QxB9tBZ0qKUbrC0q&iss=http%3A%2F%2Flocalhost%3A18080%2Frealms%2Fdemo&code=a3c1d7e2-6e0f-4b52-9c11-7f7b0e7e1a11';

const meta = {
	title: 'PageWindow',
	component: PageWindow,
	args: {
		address: LOGIN,
		marks: ['redirect_uri', 'state'],
		shows: 'The identity provider’s own page, asking for a username and a password.',
		image: '/recordings/pages/login.jpg'
	}
} satisfies Meta<typeof PageWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TheLoginPage: Story = {};

export const AllOfTheAddress: Story = { args: { everything: true } };

export const TheCodeInTheAddress: Story = {
	args: {
		address: CALLBACK,
		marks: ['code', 'state'],
		shows: 'The app’s own page, whatever it shows. What matters is the address.',
		image: null
	}
};

export const WithoutTheServer: Story = { args: { image: null } };

export const NotRecordedWithTheseSettings: Story = { args: { address: null } };
