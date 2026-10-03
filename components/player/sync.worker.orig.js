(function ()
{
	let e = `meta`, t = `presets`, n = `userPresets`, r = `index`, i = `completedShards`, a;
	function o()
	{
		return a || (a = new Promise((r, i) =>
		{
			let a = indexedDB.open(`silkdrop`, 1);
			a.onupgradeneeded = () =>
			{
				let r = a.result;
				r.objectStoreNames.contains(e) || r.createObjectStore(e),
					r.objectStoreNames.contains(t) || r.createObjectStore(t, {
						keyPath: `path`
					}),
					r.objectStoreNames.contains(n) || r.createObjectStore(n, {
						keyPath: `path`
					});
			}
				,
				a.onsuccess = () => r(a.result),
				a.onerror = () => i(a.error);
		}
		),
			a);
	}
	function s(e)
	{
		return new Promise((t, n) =>
		{
			e.onsuccess = () => t(e.result),
				e.onerror = () => n(e.error);
		}
		);
	}
	function c(e)
	{
		return new Promise((t, n) =>
		{
			e.oncomplete = () => t(),
				e.onerror = () => n(e.error),
				e.onabort = () => n(e.error);
		}
		);
	}
	async function l()
	{
		return s((await o()).transaction(e).objectStore(e).get(r));
	}
	async function u(t)
	{
		let n = (await o()).transaction(e, `readwrite`);
		n.objectStore(e).put(t, r),
			await c(n);
	}
	async function d()
	{
		let t = await s((await o()).transaction(e).objectStore(e).get(i));
		return new Set(t ?? []);
	}
	async function f(t)
	{
		let n = (await o()).transaction(e, `readwrite`);
		n.objectStore(e).put([...t].sort((e, t) => e - t), i),
			await c(n);
	}
	async function p(e, n)
	{
		let r = (await o()).transaction(t, `readwrite`)
			, i = r.objectStore(t);
		for(let e of n)
			i.put(e);
		await c(r);
		let a = await d();
		a.add(e),
			await f(a);
	}
	async function m()
	{
		let n = (await o()).transaction([t, e], `readwrite`);
		n.objectStore(t).clear(),
			n.objectStore(e).delete(i),
			n.objectStore(e).delete(r),
			await c(n);
	}
	let h = !1
		, g = !1;
	function _(e)
	{
		self.postMessage(e);
	}
	function v(e, t)
	{
		return t ? `${t}/${e}.milk` : `${e}.milk`;
	}
	async function y(e)
	{
		let t = await fetch(`${e}`, {
			priority: `low`
		});
		if(!t.ok)
			throw Error(`${e}: HTTP ${t.status}`);
		return await t.json();
	}
	async function b()
	{
		let e = await l();
		if(e)
			return e;
		let t = await y(`/presets/index.json.gz`);
		return await u(t),
			t;
	}
	let x = new Set, S, C = new Set;
	async function w(e, t)
	{
		if(C.has(e) || x.has(e))
			return !1;
		x.add(e);
		try
		{
			let n = await y(`/presets/shard-${String(e).padStart(3, `0`)}.json.gz`)
				, r = e * t.shardSize;
			return await p(e, n.map((e, n) =>
			{
				let [i, a] = t.presets[r + n];
				return {
					path: v(i, a),
					text: e
				};
			}
			)),
				C.add(e),
				!0;
		} catch(t)
		{
			return _({
				type: `error`,
				message: t instanceof Error ? t.message : String(t),
				shard: e
			}),
				!1;
		} finally
		{
			x.delete(e);
		}
	}
	function T(e)
	{
		return Math.ceil(e.count / e.shardSize);
	}
	async function E()
	{
		if(!g)
		{
			g = !0;
			try
			{
				let e = S ??= await b();
				C = await d();
				let t = T(e);
				_({
					type: `index`,
					index: e,
					completedShards: [...C]
				}),
					O(C, t, e);
				for(let n = 0; n < t; n++)
					if(!C.has(n))
					{
						for(; h;)
							await A(250);
						for(; !self.navigator.onLine;)
							await A(2e3);
						await w(n, e) && O(C, t, e);
					}
				_({
					type: `done`,
					cachedPresets: k(C, e)
				});
			} catch(e)
			{
				_({
					type: `error`,
					message: e instanceof Error ? e.message : String(e)
				});
			} finally
			{
				g = !1;
			}
		}
	}
	async function D(e)
	{
		let t = S ??= await b();
		await w(e, t) && O(C, T(t), t);
	}
	function O(e, t, n)
	{
		_({
			type: `progress`,
			completedShards: [...e],
			totalShards: t,
			cachedPresets: k(e, n)
		});
	}
	function k(e, t)
	{
		let n = 0;
		for(let r of e)
		{
			let e = r * t.shardSize;
			n += Math.min(t.shardSize, Math.max(0, t.count - e));
		}
		return n;
	}
	function A(e)
	{
		return new Promise(t => setTimeout(t, e));
	}
	self.onmessage = e =>
	{
		switch(e.data.type)
		{
			case `start`:
				E();
				break;
			case `pause`:
				h = !0;
				break;
			case `resume`:
				h = !1,
					g || E();
				break;
			case `prioritize`:
				D(e.data.shard);
				break;
			case `clear`:
				C = new Set,
					m().then(() => _({
						type: `cleared`
					}));
				break;
		}
	};
}
)();
